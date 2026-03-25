"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authRateLimit } from "@/lib/rate-limit";
import { signUpSchema, signInSchema } from "@/lib/validations/auth";

/**
 * Generic auth error message per OWASP guidelines.
 * Never reveals whether an email exists in the system.
 */
const GENERIC_AUTH_ERROR = "Invalid email or password. Please try again.";

/**
 * Maximum concurrent sessions allowed per user (D-13).
 */
const MAX_SESSIONS = 3;

/**
 * Extracts the client IP address from request headers.
 */
async function getClientIp(): Promise<string> {
	const headerStore = await headers();
	return (
		headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
		headerStore.get("x-real-ip") ||
		"unknown"
	);
}

/**
 * Sign up a new user with email and password.
 *
 * Flow: Rate limit by IP -> validate with signUpSchema -> call Supabase signUp ->
 * return success (redirect to /verify-email) or error.
 *
 * Per D-07: With "Confirm email" enabled in Supabase, session is null after signup.
 * Per OWASP: Uses generic error messages -- never reveals if email exists.
 */
export async function signUp(
	formData: FormData,
): Promise<{ success: boolean; error?: string; email?: string }> {
	// Rate limit by IP
	const ip = await getClientIp();
	const { success: allowed } = await authRateLimit.limit(ip);
	if (!allowed) {
		return {
			success: false,
			error: "Too many attempts. Please wait a moment before trying again.",
		};
	}

	// Validate input
	const rawData = {
		email: formData.get("email"),
		password: formData.get("password"),
		confirmPassword: formData.get("confirmPassword"),
	};

	const parsed = signUpSchema.safeParse(rawData);
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message || "Invalid input.";
		return { success: false, error: firstError };
	}

	const { email, password } = parsed.data;

	// Create user in Supabase
	const supabase = await createClient();
	const siteUrl =
		process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

	const { error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			emailRedirectTo: `${siteUrl}/api/auth/callback`,
		},
	});

	if (error) {
		// OWASP: Never reveal if email already exists.
		// Supabase may return "User already registered" -- mask it.
		console.error("Signup error:", error.message);
		return {
			success: false,
			error: GENERIC_AUTH_ERROR,
		};
	}

	return { success: true, email };
}

/**
 * Sign in an existing user with email and password.
 *
 * Flow: Rate limit by IP -> validate with signInSchema -> call Supabase signInWithPassword ->
 * check MFA level -> record session in user_sessions table (D-13) ->
 * if session count > MAX_SESSIONS, invalidate oldest -> return success or error.
 */
export async function signIn(
	formData: FormData,
): Promise<{
	success: boolean;
	error?: string;
	mfaRequired?: boolean;
	redirectTo?: string;
}> {
	// Rate limit by IP
	const ip = await getClientIp();
	const { success: allowed } = await authRateLimit.limit(ip);
	if (!allowed) {
		return {
			success: false,
			error: "Too many attempts. Please wait a moment before trying again.",
		};
	}

	// Validate input
	const rawData = {
		email: formData.get("email"),
		password: formData.get("password"),
	};

	const parsed = signInSchema.safeParse(rawData);
	if (!parsed.success) {
		const firstError = parsed.error.issues[0]?.message || "Invalid input.";
		return { success: false, error: firstError };
	}

	const { email, password } = parsed.data;

	// Sign in with Supabase
	const supabase = await createClient();
	const { data, error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});

	if (error) {
		return { success: false, error: GENERIC_AUTH_ERROR };
	}

	// Check MFA level
	const {
		data: mfaData,
		error: mfaError,
	} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

	if (!mfaError && mfaData.nextLevel === "aal2" && mfaData.currentLevel !== "aal2") {
		return { success: true, mfaRequired: true };
	}

	// Record session in user_sessions table (D-13)
	if (data.session && data.user) {
		const headerStore = await headers();
		const deviceInfo = headerStore.get("user-agent") || "unknown";

		try {
			const admin = createAdminClient();

			// Insert new session record
			await admin.from("user_sessions").insert({
				user_id: data.user.id,
				session_id: data.session.access_token.slice(-32), // Unique identifier from token
				device_info: deviceInfo,
				ip_address: ip,
			});

			// Enforce max sessions: if > MAX_SESSIONS, delete oldest
			const { data: sessions } = await admin
				.from("user_sessions")
				.select("id, created_at")
				.eq("user_id", data.user.id)
				.order("created_at", { ascending: true });

			if (sessions && sessions.length > MAX_SESSIONS) {
				const sessionsToRemove = sessions.slice(
					0,
					sessions.length - MAX_SESSIONS,
				);
				const idsToRemove = sessionsToRemove.map((s) => s.id);
				await admin
					.from("user_sessions")
					.delete()
					.in("id", idsToRemove);
			}
		} catch (sessionError) {
			// Session tracking failure should not block login.
			console.error("Session tracking error:", sessionError);
		}
	}

	return { success: true, redirectTo: "/onboarding" };
}

/**
 * Resend email verification.
 *
 * Rate limited by email address to prevent abuse.
 */
export async function resendVerification(
	email: string,
): Promise<{ success: boolean; error?: string }> {
	if (!email || typeof email !== "string") {
		return { success: false, error: "Email is required." };
	}

	// Rate limit by email
	const { success: allowed } = await authRateLimit.limit(`resend:${email}`);
	if (!allowed) {
		return {
			success: false,
			error: "Too many attempts. Please wait a moment before trying again.",
		};
	}

	const supabase = await createClient();
	const { error } = await supabase.auth.resend({
		type: "signup",
		email,
	});

	if (error) {
		// Do not reveal whether the email exists
		console.error("Resend verification error:", error.message);
	}

	// Always return success to prevent email enumeration
	return { success: true };
}
