import { createAdminClient } from "@/lib/supabase/admin";
import { sendWantlistMatchEmail } from "@/lib/notifications/email";

/**
 * Check if any users have a given release on their wantlist and notify them.
 *
 * Uses admin client to bypass RLS for cross-user notification inserts.
 * Entire function is non-fatal -- errors are caught and logged (per D-16).
 *
 * @param releaseId - The UUID of the release just added to someone's collection
 * @param excludeUserId - The user who added the record (don't notify them about their own addition)
 */
export async function checkWantlistMatches(
	releaseId: string,
	excludeUserId: string,
): Promise<void> {
	try {
		const admin = createAdminClient();

		// Cap fan-out at 100 notifications per release add to prevent email/DB flooding
		// on popular records. Users on position >100 will be notified on the next
		// collection update that includes this release.
		const { data: matches, error: matchError } = await admin
			.from("wantlist_items")
			.select("user_id")
			.eq("release_id", releaseId)
			.neq("user_id", excludeUserId)
			.limit(100);

		if (matchError || !matches || matches.length === 0) {
			return;
		}

		// Get release info
		const { data: release } = await admin
			.from("releases")
			.select("title, artist, discogs_id")
			.eq("id", releaseId)
			.single();

		if (!release) {
			return;
		}

		// Skip matching for releases without canonical Discogs ID (per D-16)
		if (release.discogs_id === null || release.discogs_id === undefined) {
			return;
		}

		// Get the adder's profile
		const { data: adderProfile } = await admin
			.from("profiles")
			.select("username")
			.eq("id", excludeUserId)
			.single();

		const adderUsername = adderProfile?.username ?? "A digger";

		// Notify each matched user
		for (const match of matches) {
			try {
				// Dedup: skip if this user was already notified about this release in the last 24h
				const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
				const { data: existing } = await admin
					.from("notifications")
					.select("id")
					.eq("user_id", match.user_id)
					.eq("type", "wantlist_match")
					.contains("body", release.title)
					.gte("created_at", since)
					.limit(1)
					.maybeSingle();
				if (existing) continue;

				// Insert in-app notification
				await admin.from("notifications").insert({
					user_id: match.user_id,
					type: "wantlist_match",
					title: "Wantlist match found!",
					body: `${adderUsername} has "${release.title}" by ${release.artist}`,
					link: `/perfil/${adderProfile?.username ?? ""}`,
					read: false,
				});

				// Check email preferences
				const { data: prefs } = await admin
					.from("notification_preferences")
					.select("wantlist_match_email")
					.eq("user_id", match.user_id)
					.maybeSingle();

				// Default to true if no preferences row exists (per D-18)
				if (prefs?.wantlist_match_email !== false) {
					// Get user's email address
					const { data: userData } =
						await admin.auth.admin.getUserById(match.user_id);

					const email = userData?.user?.email;
					if (email) {
						await sendWantlistMatchEmail(
							email,
							release.title,
							release.artist,
							adderUsername,
						);
					}
				}
			} catch (error) {
				// Per-user notification failure is non-fatal
				console.error(
					`Failed to notify user ${match.user_id} about wantlist match:`,
					error,
				);
			}
		}
	} catch (error) {
		// Entire function is non-fatal
		console.error("checkWantlistMatches failed:", error);
	}
}
