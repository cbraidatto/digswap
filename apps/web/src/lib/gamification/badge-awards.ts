import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Badge Award Thresholds (for callers):
 *
 *   first_dig   - collection count >= 1
 *   century_club - collection count >= 100
 *   rare_find   - rarity_score >= 3.0 (Safira/Diamante gem tier)
 *   crew_member - joined a community group
 *   critic      - wrote first review
 */

/**
 * Awards a badge to a user by slug. Idempotent - duplicate awards are absorbed
 * by the unique constraint on user_badges and treated as a no-op.
 *
 * Uses the admin client to bypass RLS (badges are service-managed).
 * Creates an in-app notification on successful award.
 *
 * @returns true if badge was newly awarded, false if already had it or not found
 */
export async function awardBadge(userId: string, badgeSlug: string): Promise<boolean> {
	try {
		const admin = createAdminClient();

		// Look up badge by slug
		const { data: badge, error: badgeError } = await admin
			.from("badges")
			.select("id, name")
			.eq("slug", badgeSlug)
			.single();

		if (badgeError || !badge) {
			console.error(`[awardBadge] Badge not found: ${badgeSlug}`, badgeError);
			return false;
		}

		// A concurrent duplicate hits the unique constraint and is treated as an
		// already-awarded no-op below, so this remains safe under races.
		const { data: inserted, error: insertError } = await admin
			.from("user_badges")
			.insert({
				user_id: userId,
				badge_id: badge.id,
				earned_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		if (insertError) {
			// 23505 = unique_violation - already awarded, not an error
			if (insertError.code === "23505") {
				return false;
			}
			console.error(`[awardBadge] Failed to insert badge: ${badgeSlug}`, insertError);
			return false;
		}

		if (!inserted) {
			return false;
		}

		// Create notification (non-blocking - badge award itself succeeded)
		await admin.from("notifications").insert({
			user_id: userId,
			type: "new_badge",
			title: `Badge earned: ${badge.name}`,
			body: `You've earned the ${badge.name} badge!`,
			link: "/perfil",
		});

		return true;
	} catch (err) {
		console.error(`[awardBadge] Unexpected error:`, err);
		return false;
	}
}
