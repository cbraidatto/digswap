"use server";

import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { onboardingProfileSchema, skipToStepSchema } from "@/lib/validations/onboarding";

/**
 * Update user profile during onboarding step 1.
 * Sets display_name and optionally avatar_url.
 *
 * Validates display_name: 3-50 chars, alphanumeric + hyphens/underscores.
 */
export async function updateProfile(
	formData: FormData,
): Promise<{ success: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		const displayName = formData.get("display_name") as string;
		const avatarUrl = formData.get("avatar_url") as string | null;

		// Validate with Zod
		const parsed = onboardingProfileSchema.safeParse({
			display_name: displayName,
			avatar_url: avatarUrl,
		});
		if (!parsed.success) {
			return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		await db
			.update(profiles)
			.set({
				displayName: parsed.data.display_name.trim(),
				...(parsed.data.avatar_url?.trim() ? { avatarUrl: parsed.data.avatar_url.trim() } : {}),
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, user.id));

		return { success: true };
	} catch (err) {
		console.error("[updateProfile] error:", err);
		return {
			success: false,
			error: "Failed to update profile. Please try again.",
		};
	}
}

/**
 * Mark onboarding as completed for the current user.
 * Sets onboarding_completed = true in the profiles table.
 * Returns a redirect path to the main app.
 */
export async function completeOnboarding(): Promise<{
	success: boolean;
	error?: string;
	redirectTo?: string;
}> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many requests. Please wait a moment." };
		}

		await db
			.update(profiles)
			.set({
				onboardingCompleted: true,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, user.id));

		return { success: true, redirectTo: "/feed" };
	} catch (err) {
		console.error("[completeOnboarding] error:", err);
		return {
			success: false,
			error: "Failed to complete onboarding. Please try again.",
		};
	}
}

/**
 * Skip to next step -- a no-op server action that returns the next step number.
 * Used to track progress without requiring database writes for skipped steps.
 */
export async function skipToStep(
	step: number,
): Promise<{ success: boolean; nextStep: number; error?: string }> {
	try {
		const parsed = skipToStepSchema.safeParse({ step });
		if (!parsed.success) {
			return { success: false, nextStep: step, error: "Invalid step number" };
		}

		// Auth check — prevent unauthenticated access to onboarding state
		await requireUser();

		return { success: true, nextStep: parsed.data.step };
	} catch (err) {
		console.error("[skipToStep] error:", err);
		return { success: false, nextStep: step, error: "Failed to skip step." };
	}
}
