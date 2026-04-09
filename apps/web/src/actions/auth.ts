"use server";

import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { extractSessionId } from "@/lib/auth/session-utils";
import { db } from "@/lib/db";
import { publicEnv } from "@/lib/env";
import { authRateLimit, resetRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
	forgotPasswordSchema,
	resetPasswordSchema,
	signInSchema,
	signUpSchema,
} from "@/lib/validations/auth";

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
	try {
		// Rate limit by IP
		const ip = await getClientIp();
		const { success: allowed } = await safeLimit(authRateLimit, ip, true);
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
		const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

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
	} catch (err) {
		console.error("[signUp] error:", err);
		return { success: false, error: "Something went wrong. Please try again." };
	}
}

/**
 * Sign in an existing user with email and password.
 *
 * Flow: Rate limit by IP -> validate with signInSchema -> call Supabase signInWithPassword ->
 * check MFA level -> record session in user_sessions table (D-13) ->
 * if session count > MAX_SESSIONS, invalidate oldest -> return success or error.
 */
export async function signIn(formData: FormData): Promise<{
	success: boolean;
	error?: string;
	mfaRequired?: boolean;
	redirectTo?: string;
}> {
	try {
		// Rate limit by IP
		const ip = await getClientIp();
		const { success: allowed } = await safeLimit(authRateLimit, ip, true);
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
		const { data: mfaData, error: mfaError } =
			await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

		if (!mfaError && mfaData.nextLevel === "aal2" && mfaData.currentLevel !== "aal2") {
			return { success: true, mfaRequired: true };
		}

		// Record session in user_sessions table (D-13)
		if (data.session && data.user) {
			const headerStore = await headers();
			const deviceInfo = headerStore.get("user-agent") || "unknown";

			try {
				const admin = createAdminClient();

				// Use the real Supabase session_id from the JWT so the middleware
				// allowlist check (which also extracts session_id from the JWT) will
				// find a matching row.  Falling back to randomUUID() would make every
				// session look "untracked" and either pass silently or block the user.
				const sessionId = extractSessionId(data.session.access_token) ?? crypto.randomUUID();

				// Insert new session record
				await admin.from("user_sessions").insert({
					user_id: data.user.id,
					session_id: sessionId,
					device_info: deviceInfo,
					ip_address: ip,
				});

				// Enforce max sessions: keep the newest MAX_SESSIONS, delete the rest.
				await db.execute(sql`
					DELETE FROM user_sessions
					WHERE user_id = ${data.user.id}
					  AND id NOT IN (
						SELECT id
						FROM user_sessions
						WHERE user_id = ${data.user.id}
						ORDER BY created_at DESC
						LIMIT ${MAX_SESSIONS}
					)
				`);
			} catch (sessionError) {
				// Session tracking failure should not block login.
				console.error("Session tracking error:", sessionError);
			}
		}

		return { success: true, redirectTo: "/onboarding" };
	} catch (err) {
		console.error("[signIn] error:", err);
		return { success: false, error: "Something went wrong. Please try again." };
	}
}

/**
 * Resend email verification.
 *
 * Rate limited by email address to prevent abuse.
 */
export async function resendVerification(
	email: string,
): Promise<{ success: boolean; error?: string }> {
	try {
		if (!email || typeof email !== "string") {
			return { success: false, error: "Email is required." };
		}

		// Rate limit by email
		const { success: allowed } = await safeLimit(authRateLimit, `resend:${email}`, true);
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
	} catch (err) {
		console.error("[resendVerification] error:", err);
		return { success: false, error: "Something went wrong. Please try again." };
	}
}

/**
 * Request a password reset email.
 *
 * OWASP: ALWAYS returns success regardless of whether the email exists.
 * This prevents email enumeration attacks.
 *
 * Rate limited: 3 requests per 15 minutes per email (per D-16).
 */
export async function forgotPassword(
	formData: FormData,
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> }> {
	try {
		const rawData = {
			email: formData.get("email"),
		};

		// Validate input
		const parsed = forgotPasswordSchema.safeParse(rawData);
		if (!parsed.success) {
			return {
				success: false,
				message: "Please enter a valid email address.",
				errors: parsed.error.flatten().fieldErrors,
			};
		}

		const { email } = parsed.data;

		// Rate limit by email (3 per 15 min)
		const { success: withinLimit } = await safeLimit(resetRateLimit, email.toLowerCase(), true);
		if (!withinLimit) {
			return {
				success: false,
				message: "Too many attempts. Please wait a moment before trying again.",
			};
		}

		const supabase = await createClient();
		const siteUrl = publicEnv.NEXT_PUBLIC_SITE_URL;

		// Send reset email -- errors are intentionally swallowed (OWASP)
		await supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${siteUrl}/api/auth/callback?next=/reset-password`,
		});

		// ALWAYS return success to prevent email enumeration
		return {
			success: true,
			message: "If an account exists for this email, a reset link has been sent. Check your inbox.",
		};
	} catch (err) {
		console.error("[forgotPassword] error:", err);
		return {
			success: false,
			message: "Something went wrong. Please try again.",
		};
	}
}

/**
 * Update user password (called from reset password page).
 *
 * The user reaches this page via the email link, which exchanges the
 * recovery token for a session through the OAuth callback route.
 * At this point the user has a valid session with a recovery token.
 *
 * Rate limited by IP using authRateLimit (5 per 60 seconds).
 */
export async function resetPassword(
	formData: FormData,
): Promise<{ success: boolean; message: string; errors?: Record<string, string[]> }> {
	try {
		const rawData = {
			password: formData.get("password"),
			confirmPassword: formData.get("confirmPassword"),
		};

		// Validate input (same strength rules as signup per D-18)
		const parsed = resetPasswordSchema.safeParse(rawData);
		if (!parsed.success) {
			return {
				success: false,
				message: "Please fix the errors below.",
				errors: parsed.error.flatten().fieldErrors,
			};
		}

		// Rate limit by IP
		const ip = await getClientIp();
		const { success: withinLimit } = await safeLimit(authRateLimit, ip, true);
		if (!withinLimit) {
			return {
				success: false,
				message: "Too many attempts. Please wait a moment before trying again.",
			};
		}

		const supabase = await createClient();

		const { error } = await supabase.auth.updateUser({
			password: parsed.data.password,
		});

		if (error) {
			// Handle expired/invalid recovery link
			if (error.message?.toLowerCase().includes("expired") || error.status === 403) {
				return {
					success: false,
					message: "This reset link has expired. Request a new one.",
				};
			}

			return {
				success: false,
				message: "Something went wrong. Please try again.",
			};
		}

		return {
			success: true,
			message: "Password updated. You can now sign in with your new password.",
		};
	} catch (err) {
		console.error("[resetPassword] error:", err);
		return {
			success: false,
			message: "Something went wrong. Please try again.",
		};
	}
}

/**
 * Sign out the current user and redirect to sign-in page.
 * Uses scope: "local" (default) to sign out only the current session,
 * preserving other concurrent sessions per D-13 (max 3 sessions).
 */
export async function signOut(): Promise<never> {
	const supabase = await createClient();
	await supabase.auth.signOut();
	redirect("/signin");
}
