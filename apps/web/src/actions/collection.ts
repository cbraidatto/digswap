"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDiscogsClient, computeRarityScore } from "@/lib/discogs/client";
import { CONDITION_GRADES } from "@/lib/collection/filters";
import { logActivity } from "@/actions/social";
import { apiRateLimit } from "@/lib/rate-limit";
import { checkWantlistMatches } from "@/lib/notifications/match";
import { awardBadge } from "@/lib/gamification/badge-awards";

/**
 * Search the Discogs database for releases matching a query string.
 * Used by the "Add Record" dialog (COLL-03, D-08).
 */
export async function searchDiscogs(query: string) {
	const trimmed = (query ?? "").trim();
	if (!trimmed || trimmed.length > 200) {
		return [];
	}

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return [];
	}

	const client = await createDiscogsClient(user.id);
	const { data } = await client.database().search({
		query: trimmed,
		type: "release",
		per_page: 10,
	});

	const results = (data?.results ?? []).map(
		(r: {
			id: number;
			title?: string;
			cover_image?: string;
			thumb?: string;
			year?: string;
			format?: string[];
			genre?: string[];
			country?: string;
			community?: { have?: number; want?: number };
		}) => ({
			discogsId: r.id,
			title: r.title ?? "",
			coverImage: r.cover_image || r.thumb || null,
			year: r.year || null,
			format: r.format?.[0] || null,
			genre: r.genre || [],
			country: r.country || null,
			have: r.community?.have ?? 0,
			want: r.community?.want ?? 0,
		}),
	);

	return results;
}

/**
 * Add a Discogs release to the current user's collection.
 * Reuses existing releases table rows when possible (D-09).
 * Sets addedVia = "manual" per D-08.
 */
export async function addRecordToCollection(
	discogsId: number,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	const admin = createAdminClient();

	// Check if release already exists in our database
	const { data: existingRelease } = await admin
		.from("releases")
		.select("id")
		.eq("discogs_id", discogsId)
		.maybeSingle();

	let releaseId: string;

	if (existingRelease) {
		releaseId = existingRelease.id;
	} else {
		// Fetch full release from Discogs
		const client = await createDiscogsClient(user.id);
		const { data: release } = await client.database().getRelease(discogsId);

		const have = release.community?.have ?? 0;
		const want = release.community?.want ?? 0;

		const { data: inserted, error: insertError } = await admin
			.from("releases")
			.insert({
				discogs_id: release.id,
				title: release.title ?? "Unknown",
				artist:
					release.artists?.[0]?.name ?? "Unknown",
				year: release.year || null,
				genre: release.genres || [],
				style: release.styles || [],
				format: release.formats?.[0]?.name || null,
				cover_image_url:
					release.images?.[0]?.uri || null,
				discogs_have: have,
				discogs_want: want,
				rarity_score: computeRarityScore(have, want),
				updated_at: new Date().toISOString(),
			})
			.select("id")
			.single();

		if (insertError || !inserted) {
			return { error: "Could not save release data." };
		}

		releaseId = inserted.id;
	}

	// Check for duplicate collection item
	const { data: duplicate } = await admin
		.from("collection_items")
		.select("id")
		.eq("user_id", user.id)
		.eq("release_id", releaseId)
		.maybeSingle();

	if (duplicate) {
		return { error: "Record already in your collection" };
	}

	// Insert collection item
	const { error: collectionError } = await admin
		.from("collection_items")
		.insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "manual",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

	if (collectionError) {
		return { error: "Could not add record to collection." };
	}

	// Log activity for feed (Phase 5, D-26)
	try {
		await logActivity(user.id, "added_record", "release", releaseId, null);
	} catch {
		// Non-blocking: activity logging failure should not fail the add-record action
	}

	// Wantlist match check (Phase 6, DISC2-03)
	try {
		await checkWantlistMatches(releaseId, user.id);
	} catch {
		// Non-blocking: match check failure should not fail the add-record action
	}

	// Badge checks (Phase 8, GAME-04)
	try {
		// Count user's collection items using admin client (already in scope as `admin`)
		const { count: collectionCount } = await admin
			.from("collection_items")
			.select("*", { count: "exact", head: true })
			.eq("user_id", user.id);

		const itemCount = collectionCount ?? 0;

		if (itemCount === 1) await awardBadge(user.id, "first_dig");
		if (itemCount >= 100) await awardBadge(user.id, "century_club");

		// Check rare_find: was the added release Ultra Rare? (rarityScore >= 2.0)
		const { data: releaseData } = await admin
			.from("releases")
			.select("rarity_score")
			.eq("id", releaseId)
			.single();
		if (releaseData && releaseData.rarity_score >= 2.0) {
			await awardBadge(user.id, "rare_find");
		}
	} catch {
		// Non-blocking: badge award failure should not fail the add-record action
	}

	return { success: true };
}

const conditionGradeSchema = z.enum(CONDITION_GRADES);

/**
 * Update the physical condition grade on a collection item.
 * Includes IDOR prevention: only the owning user can update (COLL-06, D-10).
 */
export async function updateConditionGrade(
	collectionItemId: string,
	grade: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const { success: rlSuccess } = await apiRateLimit.limit(user.id);
	if (!rlSuccess) {
		return { error: "Too many requests. Please wait a moment." };
	}

	// Validate grade against allowed values
	const parsed = conditionGradeSchema.safeParse(grade);
	if (!parsed.success) {
		return { error: "Invalid condition grade." };
	}

	const admin = createAdminClient();

	const { data: updated, error } = await admin
		.from("collection_items")
		.update({
			condition_grade: parsed.data,
			updated_at: new Date().toISOString(),
		})
		.eq("id", collectionItemId)
		.eq("user_id", user.id)
		.select("id")
		.maybeSingle();

	if (error) {
		return { error: "Could not update condition grade." };
	}

	if (!updated) {
		return { error: "Not found" };
	}

	return { success: true };
}
