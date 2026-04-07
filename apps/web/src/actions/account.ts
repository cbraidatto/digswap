"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { authRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const deleteAccountSchema = z.object({
	confirmation: z.literal("DELETE MY ACCOUNT").refine(Boolean, {
		message: 'Type "DELETE MY ACCOUNT" to confirm.',
	}),
});

/**
 * Permanently deletes the authenticated user's account and all associated data.
 *
 * Security:
 * - Requires the user to type "DELETE MY ACCOUNT" as confirmation
 * - Rate limited by IP (auth limiter)
 * - Uses admin client to delete (bypasses RLS — required for full cleanup)
 * - Cascades: Supabase Auth deletion triggers ON DELETE CASCADE on all tables
 *   that reference auth.users (profiles, subscriptions, collection_items, etc.)
 *
 * LGPD Art. 18 — right to erasure.
 */
export async function deleteAccountAction(
	formData: FormData,
): Promise<{ success: boolean; error?: string }> {
	try {
		const headerStore = await headers();
		const ip =
			headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ??
			headerStore.get("x-real-ip") ??
			"unknown";

		const { success: rlSuccess } = await safeLimit(authRateLimit, ip, true);
		if (!rlSuccess) {
			return { success: false, error: "Too many attempts. Please wait before trying again." };
		}

		const parsed = deleteAccountSchema.safeParse({
			confirmation: formData.get("confirmation"),
		});
		if (!parsed.success) {
			return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid confirmation." };
		}

		const supabase = await createClient();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return { success: false, error: "Not authenticated." };
		}

		const admin = createAdminClient();

		// deleteUser cascades to all tables with auth.users FK (profiles, subscriptions,
		// collection_items, wantlist_items, etc.) via ON DELETE CASCADE constraints.
		const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
		if (deleteError) {
			console.error("[deleteAccountAction] deleteUser error:", deleteError);
			return { success: false, error: "Failed to delete account. Please contact support." };
		}

		// Sign out the current session after deletion
		await supabase.auth.signOut();

		return { success: true };
	} catch (err) {
		console.error("[deleteAccountAction] error:", err);
		return { success: false, error: "Failed to delete account. Please try again." };
	}
}
