import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Awards a badge to a user by slug. Idempotent -- returns false if
 * already awarded or if the badge slug doesn't exist.
 *
 * Uses the admin client to bypass RLS (badges are service-managed).
 * Creates an in-app notification on successful award.
 *
 * @returns true if badge was newly awarded, false otherwise
 */
export async function awardBadge(
	userId: string,
	badgeSlug: string,
): Promise<boolean> {
	try {
		const admin = createAdminClient();

		// Look up badge by slug
		const { data: badge, error: badgeError } = await admin
			.from("badges")
			.select("id, name")
			.eq("slug", badgeSlug)
			.single();

		if (badgeError || !badge) {
			console.error(
				`[awardBadge] Badge not found: ${badgeSlug}`,
				badgeError,
			);
			return false;
		}

		// Check if already awarded (idempotent)
		const { data: existing } = await admin
			.from("user_badges")
			.select("id")
			.eq("user_id", userId)
			.eq("badge_id", badge.id)
			.maybeSingle();

		if (existing) {
			return false; // Already awarded
		}

		// Award the badge
		const { error: insertError } = await admin
			.from("user_badges")
			.insert({
				user_id: userId,
				badge_id: badge.id,
				earned_at: new Date().toISOString(),
			});

		if (insertError) {
			console.error(
				`[awardBadge] Failed to insert badge: ${badgeSlug}`,
				insertError,
			);
			return false;
		}

		// Create notification
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
