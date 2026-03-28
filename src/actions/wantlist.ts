"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDiscogsClient, computeRarityScore } from "@/lib/discogs/client";
import { apiRateLimit } from "@/lib/rate-limit";
import { searchYouTube } from "@/lib/youtube/client";
export { searchYouTube };

export async function addToWantlist(
	discogsId: number,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Reuse existing release if already in DB
	const { data: existingRelease } = await admin
		.from("releases")
		.select("id")
		.eq("discogs_id", discogsId)
		.maybeSingle();

	let releaseId: string;

	if (existingRelease) {
		releaseId = existingRelease.id;
	} else {
		const client = await createDiscogsClient(user.id);
		const { data: release } = await client.database().getRelease(discogsId);
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

		if (insertError || !inserted) return { error: "Could not save release data." };
		releaseId = inserted.id;
	}

	// Duplicate check
	const { data: duplicate } = await admin
		.from("wantlist_items")
		.select("id")
		.eq("user_id", user.id)
		.eq("release_id", releaseId)
		.maybeSingle();

	if (duplicate) return { error: "Already on your wantlist" };

	const { error: wantError } = await admin
		.from("wantlist_items")
		.insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "manual",
			created_at: new Date().toISOString(),
		});

	if (wantError) return { error: "Could not add to wantlist." };

	return { success: true };
}

export async function removeFromWantlist(
	wantlistItemId: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	const { error } = await admin
		.from("wantlist_items")
		.delete()
		.eq("id", wantlistItemId)
		.eq("user_id", user.id);

	if (error) return { error: "Could not remove from wantlist." };
	return { success: true };
}

export async function markAsFound(
	wantlistItemId: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Get the wantlist item with its release_id
	const { data: item, error: fetchError } = await admin
		.from("wantlist_items")
		.select("id, release_id")
		.eq("id", wantlistItemId)
		.eq("user_id", user.id)
		.maybeSingle();

	if (fetchError || !item) return { error: "Could not find wantlist item." };

	// Mark as found
	const { error: updateError } = await admin
		.from("wantlist_items")
		.update({ found_at: new Date().toISOString() })
		.eq("id", wantlistItemId)
		.eq("user_id", user.id);

	if (updateError) return { error: "Could not mark as found." };

	// Add to collection if it has a release linked
	if (item.release_id) {
		const { data: duplicate } = await admin
			.from("collection_items")
			.select("id")
			.eq("user_id", user.id)
			.eq("release_id", item.release_id)
			.maybeSingle();

		if (!duplicate) {
			const { error: collectionError } = await admin
				.from("collection_items")
				.insert({
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
}

export async function addToWantlistFromYouTube(
	videoId: string,
	title: string,
	channelTitle: string,
	thumbnail: string,
): Promise<{ success?: boolean; error?: string; existingOwners?: number }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Check if this YouTube video is already a release in the DB
	const { data: existingRelease } = await admin
		.from("releases")
		.select("id")
		.eq("youtube_video_id", videoId)
		.maybeSingle();

	let releaseId: string;

	if (existingRelease) {
		releaseId = existingRelease.id;
	} else {
		// First person to tag this — create the canonical release
		const { data: inserted, error: insertError } = await admin
			.from("releases")
			.insert({
				youtube_video_id: videoId,
				title,
				artist: channelTitle,
				cover_image_url: thumbnail,
				updated_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		if (insertError || !inserted) return { error: "Could not save release data." };
		releaseId = inserted.id;
	}

	// Duplicate wantlist check
	const { data: duplicate } = await admin
		.from("wantlist_items")
		.select("id")
		.eq("user_id", user.id)
		.eq("release_id", releaseId)
		.maybeSingle();

	if (duplicate) return { error: "Already on your wantlist" };

	const { error: wantError } = await admin
		.from("wantlist_items")
		.insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "youtube",
			created_at: new Date().toISOString(),
		});

	if (wantError) return { error: "Could not add to wantlist." };

	// Count how many others are already hunting this
	const { count } = await admin
		.from("wantlist_items")
		.select("id", { count: "exact", head: true })
		.eq("release_id", releaseId)
		.neq("user_id", user.id);

	return { success: true, existingOwners: count ?? 0 };
}
