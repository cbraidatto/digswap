"use server";

import { computeRarityScore, createDiscogsClient } from "@/lib/discogs/client";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
	addFromYouTubeSchema,
	addToWantlistSchema,
	wantlistItemIdSchema,
} from "@/lib/validations/wantlist";
import { searchYouTube } from "@/lib/youtube/client";

export { searchYouTube };

export async function addToWantlist(
	discogsId: number,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = addToWantlistSchema.safeParse({ discogsId });
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid Discogs ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// Reuse existing release if already in DB
		const { data: existingRelease } = await admin
			.from("releases")
			.select("id")
			.eq("discogs_id", parsed.data.discogsId)
			.maybeSingle();

		let releaseId: string;

		if (existingRelease) {
			releaseId = existingRelease.id;
		} else {
			const client = await createDiscogsClient(user.id);
			const { data: release } = await client.database().getRelease(parsed.data.discogsId);
			const have = release.community?.have ?? 0;
			const want = release.community?.want ?? 0;

			const { data: inserted, error: insertError } = await admin
				.from("releases")
				.insert({
					discogs_id: release.id,
					title: release.title ?? "Unknown",
					artist: release.artists?.[0]?.name ?? "Unknown",
					year: release.year || null,
					genre: release.genres || [],
					style: release.styles || [],
					format: release.formats?.[0]?.name || null,
					cover_image_url: release.images?.[0]?.uri || null,
					discogs_have: have,
					discogs_want: want,
					rarity_score: computeRarityScore(have, want),
					updated_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			if (insertError?.code === "23505") {
				const { data: concurrentRelease } = await admin
					.from("releases")
					.select("id")
					.eq("discogs_id", release.id)
					.maybeSingle();

				if (!concurrentRelease) return { error: "Could not save release data." };
				releaseId = concurrentRelease.id;
			} else if (insertError || !inserted) {
				return { error: "Could not save release data." };
			} else {
				releaseId = inserted.id;
			}
		}

		// Duplicate check
		const { data: duplicate } = await admin
			.from("wantlist_items")
			.select("id")
			.eq("user_id", user.id)
			.eq("release_id", releaseId)
			.maybeSingle();

		if (duplicate) return { error: "Already on your wantlist" };

		const { error: wantError } = await admin.from("wantlist_items").insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "manual",
			created_at: new Date().toISOString(),
		});

		if (wantError) {
			// 23505 = unique_violation — concurrent duplicate
			if (wantError.code === "23505") return { error: "Already on your wantlist" };
			return { error: "Could not add to wantlist." };
		}

		return { success: true };
	} catch (err) {
		console.error("[addToWantlist] error:", err);
		return { error: "Failed to add to wantlist. Please try again." };
	}
}

export async function removeFromWantlist(
	wantlistItemId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = wantlistItemIdSchema.safeParse({ wantlistItemId });
		if (!parsed.success) {
			return { error: "Invalid wantlist item ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		const { error } = await admin
			.from("wantlist_items")
			.delete()
			.eq("id", parsed.data.wantlistItemId)
			.eq("user_id", user.id);

		if (error) return { error: "Could not remove from wantlist." };
		return { success: true };
	} catch (err) {
		console.error("[removeFromWantlist] error:", err);
		return { error: "Failed to remove from wantlist. Please try again." };
	}
}

export async function markAsFound(
	wantlistItemId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = wantlistItemIdSchema.safeParse({ wantlistItemId });
		if (!parsed.success) {
			return { error: "Invalid wantlist item ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// Get the wantlist item with its release_id
		const { data: item, error: fetchError } = await admin
			.from("wantlist_items")
			.select("id, release_id")
			.eq("id", parsed.data.wantlistItemId)
			.eq("user_id", user.id)
			.maybeSingle();

		if (fetchError || !item) return { error: "Could not find wantlist item." };

		// Mark as found
		const { error: updateError } = await admin
			.from("wantlist_items")
			.update({ found_at: new Date().toISOString() })
			.eq("id", parsed.data.wantlistItemId)
			.eq("user_id", user.id);

		if (updateError) return { error: "Could not mark as found." };

		// Add to collection if it has a release linked
		if (item.release_id) {
			const { data: duplicate } = await admin
				.from("collection_items")
				.select("id")
				.eq("user_id", user.id)
				.eq("release_id", item.release_id)
				.is("deleted_at", null)
				.maybeSingle();

			if (!duplicate) {
				const { error: collectionError } = await admin.from("collection_items").insert({
					user_id: user.id,
					release_id: item.release_id,
					added_via: "wantlist",
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				});

				if (collectionError) {
					console.error("Failed to add to collection:", collectionError);
					return { error: "Marked as found but could not add to collection." };
				}
			}
		}

		return { success: true };
	} catch (err) {
		console.error("[markAsFound] error:", err);
		return { error: "Failed to mark as found. Please try again." };
	}
}

export async function addToWantlistFromYouTube(
	videoId: string,
	title: string,
	channelTitle: string,
	thumbnail: string,
): Promise<{ success?: boolean; error?: string; existingOwners?: number }> {
	try {
		const parsed = addFromYouTubeSchema.safeParse({ videoId, title, channelTitle, thumbnail });
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const admin = createAdminClient();

		// Check if this YouTube video is already a release in the DB
		const { data: existingRelease } = await admin
			.from("releases")
			.select("id")
			.eq("youtube_video_id", parsed.data.videoId)
			.maybeSingle();

		let releaseId: string;

		if (existingRelease) {
			releaseId = existingRelease.id;
		} else {
			// First person to tag this — create the canonical release
			const { data: inserted, error: insertError } = await admin
				.from("releases")
				.insert({
					youtube_video_id: parsed.data.videoId,
					title: parsed.data.title,
					artist: parsed.data.channelTitle,
					cover_image_url: parsed.data.thumbnail,
					updated_at: new Date().toISOString(),
				})
				.select("id")
				.single();

			if (insertError?.code === "23505") {
				const { data: concurrentRelease } = await admin
					.from("releases")
					.select("id")
					.eq("youtube_video_id", parsed.data.videoId)
					.maybeSingle();

				if (!concurrentRelease) return { error: "Could not save release data." };
				releaseId = concurrentRelease.id;
			} else if (insertError || !inserted) {
				return { error: "Could not save release data." };
			} else {
				releaseId = inserted.id;
			}
		}

		// Duplicate wantlist check
		const { data: duplicate } = await admin
			.from("wantlist_items")
			.select("id")
			.eq("user_id", user.id)
			.eq("release_id", releaseId)
			.maybeSingle();

		if (duplicate) return { error: "Already on your wantlist" };

		const { error: wantError } = await admin.from("wantlist_items").insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "youtube",
			created_at: new Date().toISOString(),
		});

		if (wantError) {
			if (wantError.code === "23505") return { error: "Already on your wantlist" };
			return { error: "Could not add to wantlist." };
		}

		// Count how many others are already hunting this
		const { count } = await admin
			.from("wantlist_items")
			.select("id", { count: "exact", head: true })
			.eq("release_id", releaseId)
			.neq("user_id", user.id);

		return { success: true, existingOwners: count ?? 0 };
	} catch (err) {
		console.error("[addToWantlistFromYouTube] error:", err);
		return { error: "Failed to add to wantlist. Please try again." };
	}
}
