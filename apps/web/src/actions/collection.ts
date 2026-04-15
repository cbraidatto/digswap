"use server";

import { z } from "zod";
import { CONDITION_GRADES } from "@/lib/collection/filters";
import { computeRarityScore, createDiscogsClient } from "@/lib/discogs/client";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { checkWantlistMatches } from "@/lib/notifications/match";
import { apiRateLimit, safeLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/social/log-activity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations/common";

/**
 * Search the Discogs database for releases matching a query string.
 * Used by the "Add Record" dialog (COLL-03, D-08).
 */
export async function searchDiscogs(query: string) {
	try {
		const trimmed = (query ?? "").trim();
		if (!trimmed || trimmed.length > 200) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, false);
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
	} catch (err) {
		console.error("[searchDiscogs] error:", err);
		return [];
	}
}

/**
 * Add a Discogs release to the current user's collection.
 * Reuses existing releases table rows when possible (D-09).
 * Sets addedVia = "manual" per D-08.
 */
export async function addRecordToCollection(
	discogsId: number,
): Promise<{ success?: boolean; error?: string }> {
	try {
		// S-02: Validate discogsId at runtime
		const parsedId = z.number().int().positive().safeParse(discogsId);
		if (!parsedId.success) {
			return { error: "Invalid Discogs ID." };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
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

			// Extract tracklist if available
			const tracklist =
				release.tracklist?.map((t: { position?: string; title?: string; duration?: string }) => ({
					position: t.position ?? "",
					title: t.title ?? "",
					duration: t.duration ?? "",
				})) ?? null;

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
					tracklist,
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

				if (!concurrentRelease) {
					return { error: "Could not save release data." };
				}

				releaseId = concurrentRelease.id;
			} else if (insertError || !inserted) {
				return { error: "Could not save release data." };
			} else {
				releaseId = inserted.id;
			}
		}

		// Check for duplicate collection item (soft-deleted items should not block re-adding)
		const { data: duplicate } = await admin
			.from("collection_items")
			.select("id")
			.eq("user_id", user.id)
			.eq("release_id", releaseId)
			.is("deleted_at", null)
			.maybeSingle();

		if (duplicate) {
			return { error: "Record already in your collection" };
		}

		// Insert collection item — unique constraint (user_id, release_id) catches concurrent duplicates
		const { error: collectionError } = await admin.from("collection_items").insert({
			user_id: user.id,
			release_id: releaseId,
			added_via: "manual",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		});

		if (collectionError) {
			// 23505 = unique_violation — already in collection (concurrent request)
			if (collectionError.code === "23505") {
				return { error: "Record already in your collection" };
			}
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
				.eq("user_id", user.id)
				.is("deleted_at", null);

			const itemCount = collectionCount ?? 0;

			// awardBadge is idempotent and absorbs duplicate-award races internally.
			if (itemCount === 1) await awardBadge(user.id, "first_dig");
			if (itemCount >= 100) await awardBadge(user.id, "century_club");

			// Check rare_find: was the added release Safira or Diamante tier? (rarityScore >= 3.0)
			const { data: releaseData } = await admin
				.from("releases")
				.select("rarity_score")
				.eq("id", releaseId)
				.single();
			if (releaseData && releaseData.rarity_score >= 3.0) {
				await awardBadge(user.id, "rare_find");
			}
		} catch {
			// Non-blocking: badge award failure should not fail the add-record action
		}

		return { success: true };
	} catch (err) {
		console.error("[addRecordToCollection] error:", err);
		return { error: "Failed to add record to collection. Please try again." };
	}
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
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
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
	} catch (err) {
		console.error("[updateConditionGrade] error:", err);
		return { error: "Failed to update condition grade. Please try again." };
	}
}

/**
 * Remove a record from the current user's collection.
 * Includes IDOR prevention: only the owning user can delete.
 */
export async function removeRecordFromCollection(
	collectionItemId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// S-04: Use project-standard uuidSchema for validation
		const parsedItemId = uuidSchema.safeParse(collectionItemId);
		if (!parsedItemId.success) {
			return { error: "Invalid collection item ID." };
		}

		const admin = createAdminClient();

		// Delete only if the item belongs to the current user (IDOR prevention)
		const { data: deleted, error } = await admin
			.from("collection_items")
			.delete()
			.eq("id", collectionItemId)
			.eq("user_id", user.id)
			.select("id")
			.maybeSingle();

		if (error) {
			return { error: "Could not remove record from collection." };
		}

		if (!deleted) {
			return { error: "Not found" };
		}

		return { success: true };
	} catch (err) {
		console.error("[removeRecordFromCollection] error:", err);
		return { error: "Failed to remove record. Please try again." };
	}
}

const visibilitySchema = z.enum(["tradeable", "not_trading", "private"]);

/**
 * Set the visibility state on a collection item.
 * Replaces the binary open_for_trade with three-state visibility.
 */
export async function setVisibility(
	collectionItemId: string,
	visibility: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) return { error: "Too many requests." };

		const parsedId = uuidSchema.safeParse(collectionItemId);
		if (!parsedId.success) return { error: "Invalid ID." };

		const parsedVis = visibilitySchema.safeParse(visibility);
		if (!parsedVis.success) return { error: "Invalid visibility value." };

		const admin = createAdminClient();
		const { data, error } = await admin
			.from("collection_items")
			.update({
				visibility: parsedVis.data,
				updated_at: new Date().toISOString(),
			})
			.eq("id", parsedId.data)
			.eq("user_id", user.id)
			.select("id")
			.maybeSingle();

		if (error) return { error: "Could not update visibility." };
		if (!data) return { error: "Not found" };
		return { success: true };
	} catch (err) {
		console.error("[setVisibility] error:", err);
		return { error: "Failed to update visibility. Please try again." };
	}
}

const qualityMetadataSchema = z.object({
	audioFormat: z.string().max(50).nullable().optional(),
	bitrate: z.number().int().positive().max(9999).nullable().optional(),
	sampleRate: z.number().int().positive().max(384000).nullable().optional(),
});

/**
 * Update audio quality metadata on a collection item.
 * Used for trade proposals to declare file quality.
 */
export async function updateQualityMetadata(
	collectionItemId: string,
	metadata: { audioFormat?: string | null; bitrate?: number | null; sampleRate?: number | null },
): Promise<{ success?: boolean; error?: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) return { error: "Too many requests." };

		const parsedId = uuidSchema.safeParse(collectionItemId);
		if (!parsedId.success) return { error: "Invalid ID." };

		const parsedMeta = qualityMetadataSchema.safeParse(metadata);
		if (!parsedMeta.success) return { error: "Invalid quality metadata." };

		const updatePayload: Record<string, unknown> = {
			updated_at: new Date().toISOString(),
		};
		if (parsedMeta.data.audioFormat !== undefined) {
			updatePayload.audio_format = parsedMeta.data.audioFormat;
		}
		if (parsedMeta.data.bitrate !== undefined) {
			updatePayload.bitrate = parsedMeta.data.bitrate;
		}
		if (parsedMeta.data.sampleRate !== undefined) {
			updatePayload.sample_rate = parsedMeta.data.sampleRate;
		}

		const admin = createAdminClient();
		const { data, error } = await admin
			.from("collection_items")
			.update(updatePayload)
			.eq("id", parsedId.data)
			.eq("user_id", user.id)
			.select("id")
			.maybeSingle();

		if (error) return { error: "Could not update quality metadata." };
		if (!data) return { error: "Not found" };
		return { success: true };
	} catch (err) {
		console.error("[updateQualityMetadata] error:", err);
		return { error: "Failed to update quality metadata. Please try again." };
	}
}

/**
 * Toggle the "open for trade" flag on a collection item.
 * @deprecated Use setVisibility() directly. This delegates internally for backward compat.
 */
export async function toggleOpenForTrade(
	collectionItemId: string,
	openForTrade: boolean,
): Promise<{ success?: boolean; error?: string }> {
	return setVisibility(collectionItemId, openForTrade ? "tradeable" : "not_trading");
}

/**
 * Update notes on a collection item.
 */
export async function updateCollectionNotes(
	collectionItemId: string,
	notes: string | null,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) return { error: "Too many requests." };

		const parsed = uuidSchema.safeParse(collectionItemId);
		if (!parsed.success) return { error: "Invalid ID." };

		const trimmed = notes?.trim().slice(0, 500) ?? null;

		const admin = createAdminClient();
		const { data, error } = await admin
			.from("collection_items")
			.update({ notes: trimmed, updated_at: new Date().toISOString() })
			.eq("id", parsed.data)
			.eq("user_id", user.id)
			.select("id")
			.maybeSingle();

		if (error || !data) return { error: "Could not update." };
		return { success: true };
	} catch (err) {
		console.error("[updateCollectionNotes] error:", err);
		return { error: "Failed to update. Please try again." };
	}
}

/**
 * Set a personal rating (1-5) on a collection item.
 */
export async function setPersonalRating(
	collectionItemId: string,
	rating: number | null,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) return { error: "Not authenticated" };

		const { success: rlSuccess } = await safeLimit(apiRateLimit, user.id, true);
		if (!rlSuccess) return { error: "Too many requests." };

		const parsed = uuidSchema.safeParse(collectionItemId);
		if (!parsed.success) return { error: "Invalid ID." };

		if (rating !== null && (rating < 1 || rating > 5 || !Number.isInteger(rating))) {
			return { error: "Rating must be 1-5." };
		}

		const admin = createAdminClient();
		const { data, error } = await admin
			.from("collection_items")
			.update({ personal_rating: rating, updated_at: new Date().toISOString() })
			.eq("id", parsed.data)
			.eq("user_id", user.id)
			.select("id")
			.maybeSingle();

		if (error || !data) return { error: "Could not update." };
		return { success: true };
	} catch (err) {
		console.error("[setPersonalRating] error:", err);
		return { error: "Failed to update. Please try again." };
	}
}
