import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { wantlistItems } from "@/lib/db/schema/wantlist";

export interface WantlistIntersection {
	releaseId: string;
	discogsId: number | null;
	releaseTitle: string;
	releaseArtist: string;
	rarityScore: number | null;
	coverArt: string | null;
}

/**
 * Returns releases that are in currentUser's wantlist AND targetUser's collection.
 * Maximum 20 results, sorted by rarity score desc (most rare first).
 */
export async function getWantlistIntersections(
	currentUserId: string,
	targetUserId: string,
): Promise<WantlistIntersection[]> {
	const results = await db
		.select({
			releaseId: releases.id,
			discogsId: releases.discogsId,
			releaseTitle: releases.title,
			releaseArtist: releases.artist,
			rarityScore: releases.rarityScore,
			coverArt: releases.coverImageUrl,
		})
		.from(wantlistItems)
		.innerJoin(
			collectionItems,
			and(
				eq(wantlistItems.releaseId, collectionItems.releaseId),
				eq(collectionItems.userId, targetUserId),
			),
		)
		.innerJoin(releases, eq(wantlistItems.releaseId, releases.id))
		.where(eq(wantlistItems.userId, currentUserId))
		.orderBy(desc(releases.rarityScore))
		.limit(20);

	return results.map((r) => ({
		releaseId: r.releaseId,
		discogsId: r.discogsId,
		releaseTitle: r.releaseTitle ?? "Unknown Title",
		releaseArtist: r.releaseArtist ?? "",
		rarityScore: r.rarityScore,
		coverArt: r.coverArt ?? null,
	}));
}

/**
 * Get compatibility stats between two users:
 * - sharedRecords: records both users have in their collection
 * - wantlistMatches: records user A wants that user B has (and vice versa)
 */
export async function getCompatibilityScore(
	userA: string,
	userB: string,
): Promise<{ sharedRecords: number; wantlistMatches: number }> {
	const [shared] = await db.execute(sql`
		SELECT count(*)::int AS count FROM (
			SELECT release_id FROM collection_items WHERE user_id = ${userA}
			INTERSECT
			SELECT release_id FROM collection_items WHERE user_id = ${userB}
		) AS shared
	`);

	const [matches] = await db.execute(sql`
		SELECT count(*)::int AS count FROM (
			SELECT release_id FROM wantlist_items WHERE user_id = ${userA} AND found_at IS NULL
			INTERSECT
			SELECT release_id FROM collection_items WHERE user_id = ${userB}
			UNION
			SELECT release_id FROM wantlist_items WHERE user_id = ${userB} AND found_at IS NULL
			INTERSECT
			SELECT release_id FROM collection_items WHERE user_id = ${userA}
		) AS matches
	`);

	return {
		sharedRecords: Number((shared as unknown as { count: number }).count ?? 0),
		wantlistMatches: Number((matches as unknown as { count: number }).count ?? 0),
	};
}
