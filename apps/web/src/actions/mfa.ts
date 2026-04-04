"use server";

import { and, eq } from "drizzle-orm";
import { consumeBackupCode, generateBackupCodes, storeBackupCodes } from "@/lib/backup-codes";
import { db } from "@/lib/db";
import { backupCodes } from "@/lib/db/schema/sessions";
import { profiles } from "@/lib/db/schema/users";
import { totpRateLimit , safeLimit} from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { backupCodeSchema, totpSchema } from "@/lib/validations/auth";

type MfaResult<T = Record<string, unknown>> =
	| { success: true; data: T }
	| { success: false; error: string };

/**
 * Enroll a new TOTP factor for the current user.
 * Generates 10 backup codes, stores hashed versions in DB.
 * Returns the QR code SVG, TOTP URI, and plaintext backup codes (shown once).
 */
export async function enrollTotp(): Promise<
	MfaResult<{
		factorId: string;
		qrCode: string;
		uri: string;
		backupCodes: string[];
	}>
> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Not authenticated." };
		}

		// Enroll TOTP factor
		const { data, error } = await supabase.auth.mfa.enroll({
			factorType: "totp",
			friendlyName: "DigSwap",
		});

		if (error || !data) {
			return {
				success: false,
				error: error?.message ?? "Failed to enroll TOTP factor.",
			};
		}

		// Generate and store backup codes
		const codes = generateBackupCodes(10);
		await storeBackupCodes(user.id, codes);

		return {
			success: true,
			data: {
				factorId: data.id,
				qrCode: data.totp.qr_code,
				uri: data.totp.uri,
				backupCodes: codes,
			},
		};
	} catch (err) {
		console.error("[enrollTotp] error:", err);
		return { success: false, error: "Failed to enroll TOTP. Please try again." };
	}
}

/**
 * Verify TOTP enrollment by challenging and verifying a code.
 * After successful verification, marks the user's profile as 2FA-enabled.
 */
export async function verifyTotpEnrollment(factorId: string, code: string): Promise<MfaResult> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Not authenticated." };
		}

		// Rate limit by user ID
		const { success: allowed } = await safeLimit(totpRateLimit, user.id, true);
		if (!allowed) {
			return {
				success: false,
				error: "Too many attempts. Please wait a few minutes and try again.",
			};
		}

		// Validate code format
		const parsed = totpSchema.safeParse({ code });
		if (!parsed.success) {
			return {
				success: false,
				error: "Invalid code. Please check your authenticator app and try again.",
			};
		}

		// Challenge the factor
		const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
			factorId,
		});

		if (challengeError || !challengeData) {
			return {
				success: false,
				error: challengeError?.message ?? "Failed to create MFA challenge.",
			};
		}

		// Verify the code
		const { error: verifyError } = await supabase.auth.mfa.verify({
			factorId,
			challengeId: challengeData.id,
			code: parsed.data.code,
		});

		if (verifyError) {
			return {
				success: false,
				error: "Invalid code. Please check your authenticator app and try again.",
			};
		}

		// Update profile to mark 2FA as enabled
		await db
			.update(profiles)
			.set({ twoFactorEnabled: true, updatedAt: new Date() })
			.where(eq(profiles.id, user.id));

		return { success: true, data: {} };
	} catch (err) {
		console.error("[verifyTotpEnrollment] error:", err);
		return { success: false, error: "Failed to verify TOTP. Please try again." };
	}
}

/**
 * Challenge TOTP during login.
 * User has authenticated (AAL1) and needs to verify TOTP to reach AAL2.
 */
export async function challengeTotp(code: string): Promise<MfaResult<{ redirectTo: string }>> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Not authenticated." };
		}

		// Rate limit by user ID
		const { success: allowed } = await safeLimit(totpRateLimit, user.id, true);
		if (!allowed) {
			return {
				success: false,
				error: "Too many attempts. Please wait a few minutes and try again.",
			};
		}

		// Validate code format
		const parsed = totpSchema.safeParse({ code });
		if (!parsed.success) {
			return {
				success: false,
				error: "Invalid code. Please check your authenticator app and try again.",
			};
		}

		// Get user's TOTP factors
		const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

		if (factorsError || !factorsData) {
			return {
				success: false,
				error: factorsError?.message ?? "Failed to retrieve MFA factors.",
			};
		}

		// Find the first verified TOTP factor
		const totpFactor = factorsData.totp.find((f) => f.status === "verified");

		if (!totpFactor) {
			return { success: false, error: "No verified TOTP factor found." };
		}

		// Challenge
		const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
			factorId: totpFactor.id,
		});

		if (challengeError || !challengeData) {
			return {
				success: false,
				error: challengeError?.message ?? "Failed to create MFA challenge.",
			};
		}

		// Verify
		const { error: verifyError } = await supabase.auth.mfa.verify({
			factorId: totpFactor.id,
			challengeId: challengeData.id,
			code: parsed.data.code,
		});

		if (verifyError) {
			return {
				success: false,
				error: "Invalid code. Please check your authenticator app and try again.",
			};
		}

		// Check if user needs onboarding
		const [profile] = await db
			.select({ onboardingCompleted: profiles.onboardingCompleted })
			.from(profiles)
			.where(eq(profiles.id, user.id))
			.limit(1);

		const redirectTo = profile && !profile.onboardingCompleted ? "/onboarding" : "/feed";

		return { success: true, data: { redirectTo } };
	} catch (err) {
		console.error("[challengeTotp] error:", err);
		return { success: false, error: "Failed to verify TOTP. Please try again." };
	}
}

/**
 * Use a backup code to complete 2FA login.
 * Consumes the code (marks as used) and verifies via Supabase MFA challenge.
 */
export async function useBackupCode(
	code: string,
): Promise<MfaResult<{ redirectTo: string; remainingCodes: number }>> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Not authenticated." };
		}

		// Rate limit by user ID
		const { success: allowed } = await safeLimit(totpRateLimit, user.id, true);
		if (!allowed) {
			return {
				success: false,
				error: "Too many attempts. Please wait a few minutes and try again.",
			};
		}

		// Validate code format
		const parsed = backupCodeSchema.safeParse({ code });
		if (!parsed.success) {
			return { success: false, error: "Backup code is required." };
		}

		// Try to consume the backup code
		const result = await consumeBackupCode(user.id, parsed.data.code);

		if (!result.success) {
			return {
				success: false,
				error: "Invalid backup code. Please try another code.",
			};
		}

		// Backup code validated — elevate session context.
		//
		// Supabase's MFA API does not accept backup codes as a verify token,
		// so we cannot call mfa.challenge/verify directly.  Instead we use
		// the admin API to update user metadata to record the backup-code
		// authentication event.  The session technically stays at AAL1 on the
		// Supabase side, but we record it server-side so sensitive actions
		// (like disabling TOTP) can require a fresh TOTP verification.
		//
		// For disableTotp() the AAL2 check will still block until the user
		// re-authenticates with their TOTP app — backup code grants login
		// access but not the ability to fully remove 2FA without the TOTP app.
		try {
			const admin = createAdminClient();
			await admin.auth.admin.updateUserById(user.id, {
				user_metadata: {
					last_backup_code_auth: new Date().toISOString(),
				},
			});
		} catch {
			// Non-blocking — metadata update failure should not block login
		}

		// Check onboarding status
		const [profile] = await db
			.select({ onboardingCompleted: profiles.onboardingCompleted })
			.from(profiles)
			.where(eq(profiles.id, user.id))
			.limit(1);

		const redirectTo = profile && !profile.onboardingCompleted ? "/onboarding" : "/feed";

		return {
			success: true,
			data: {
				redirectTo,
				remainingCodes: result.remainingCodes,
			},
		};
	} catch (err) {
		console.error("[useBackupCode] error:", err);
		return { success: false, error: "Failed to verify backup code. Please try again." };
	}
}

/**
 * Disable 2FA for the current user.
 * Requires current AAL2 level (user must have verified with TOTP first).
 * Unenrolls the TOTP factor and invalidates all remaining backup codes.
 */
export async function disableTotp(): Promise<MfaResult> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { success: false, error: "Not authenticated." };
		}

		// Verify user is at AAL2
		const { data: aalData, error: aalError } =
			await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

		if (aalError || !aalData) {
			return {
				success: false,
				error: "Failed to verify authentication level.",
			};
		}

		if (aalData.currentLevel !== "aal2") {
			return {
				success: false,
				error: "You must verify with your authenticator app before disabling 2FA.",
			};
		}

		// Get and unenroll all TOTP factors
		const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

		if (factorsError || !factorsData) {
			return {
				success: false,
				error: factorsError?.message ?? "Failed to retrieve MFA factors.",
			};
		}

		for (const factor of factorsData.totp) {
			const { error: unenrollError } = await supabase.auth.mfa.unenroll({
				factorId: factor.id,
			});
			if (unenrollError) {
				return {
					success: false,
					error: unenrollError.message ?? "Failed to disable 2FA.",
				};
			}
		}

		// Update profile
		await db
			.update(profiles)
			.set({ twoFactorEnabled: false, updatedAt: new Date() })
			.where(eq(profiles.id, user.id));

		// Invalidate remaining backup codes (mark as used for audit trail)
		await db
			.update(backupCodes)
			.set({ used: true, usedAt: new Date() })
			.where(and(eq(backupCodes.userId, user.id), eq(backupCodes.used, false)));

		return { success: true, data: {} };
	} catch (err) {
		console.error("[disableTotp] error:", err);
		return { success: false, error: "Failed to disable 2FA. Please try again." };
	}
}
