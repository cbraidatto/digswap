"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { apiRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

/**
 * Validate display name: 3-50 chars, alphanumeric plus hyphens/underscores.
 */
function validateDisplayName(name: string): string | null {
	if (!name || name.trim().length < 3) {
		return "Display name must be at least 3 characters.";
	}
	if (name.trim().length > 50) {
		return "Display name must be 50 characters or less.";
	}
	if (!/^[a-zA-Z0-9_-]+$/.test(name.trim())) {
		return "Display name can only contain letters, numbers, hyphens, and underscores.";
	}
	return null;
}

/**
 * Update user profile during onboarding step 1.
 * Sets display_name and optionally avatar_url.
 *
 * Validates display_name: 3-50 chars, alphanumeric + hyphens/underscores.
 */
export async function updateProfile(
	formData: FormData,
): Promise<{ success: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { success: false, error: "Not authenticated." };
	}

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { success: false, error: "Too many requests. Please wait a moment." };
	}

	const displayName = formData.get("display_name") as string;
	const avatarUrl = formData.get("avatar_url") as string | null;

	// Validate display name
	const validationError = validateDisplayName(displayName);
	if (validationError) {
		return { success: false, error: validationError };
	}

	try {
		await db
			.update(profiles)
			.set({
				displayName: displayName.trim(),
				...(avatarUrl && avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, user.id));

		return { success: true };
	} catch {
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
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { success: false, error: "Not authenticated." };
	}

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { success: false, error: "Too many requests. Please wait a moment." };
	}

	try {
		await db
			.update(profiles)
			.set({
				onboardingCompleted: true,
				updatedAt: new Date(),
			})
			.where(eq(profiles.id, user.id));

		return { success: true, redirectTo: "/feed" };
	} catch {
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
export async function skipToStep(step: number): Promise<{ success: boolean; nextStep: number; error?: string }> {
	try {
		return { success: true, nextStep: step };
	} catch (err) {
		console.error("[skipToStep] error:", err);
		return { success: false, nextStep: step, error: "Failed to skip step." };
	}
}
