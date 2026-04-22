import { eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";

export interface ComparisonItem {
	releaseId: string;
	discogsId: number | null;
	title: string;
	artist: string;
	rarityScore: number | null;
}

export interface ComparisonResult {
	uniqueToMe: ComparisonItem[];
	inCommon: ComparisonItem[];
	uniqueToThem: ComparisonItem[];
}

/**
 * Compare two collections using database-side JOINs.
 * Previously fetched both full collections into Node.js and intersected in JS —
 * this was O(N+M) data transfer. Now pushes all three queries to the DB.
 *
 * Each query uses indexed joins on (user_id, release_id).
 */
export async function getCollectionComparison(
	myUserId: string,
	theirUserId: string,
): Promise<ComparisonResult> {
	const selectFields = {
		releaseId: releases.id,
		discogsId: releases.discogsId,
		title: releases.title,
		artist: releases.artist,
		rarityScore: releases.rarityScore,
	};

	// All three queries run in parallel
	const [inCommon, uniqueToMe, uniqueToThem] = await Promise.all([
		// Records both users own — inner join between the two collections
		db
			.select(selectFields)
			.from(collectionItems)
			.innerJoin(
				db
					.select({ releaseId: collectionItems.releaseId })
					.from(collectionItems)
					.where(
						sql`${collectionItems.userId} = ${theirUserId} AND ${collectionItems.deletedAt} IS NULL`,
					)
					.as("theirs"),
				sql`"theirs"."release_id" = ${collectionItems.releaseId}`,
			)
			.innerJoin(releases, eq(releases.id, collectionItems.releaseId))
			.where(sql`${collectionItems.userId} = ${myUserId} AND ${collectionItems.deletedAt} IS NULL`)
			.orderBy(sql`${releases.rarityScore} DESC NULLS LAST`)
			.limit(500),

		// Records I own that they don't
		db
			.select(selectFields)
			.from(collectionItems)
			.innerJoin(releases, eq(releases.id, collectionItems.releaseId))
			.where(
				sql`${collectionItems.userId} = ${myUserId}
					AND ${collectionItems.deletedAt} IS NULL
					AND NOT EXISTS (
						SELECT 1 FROM collection_items b
						WHERE b.user_id = ${theirUserId}
						  AND b.release_id = ${collectionItems.releaseId}
						  AND b.deleted_at IS NULL
					)`,
			)
			.orderBy(sql`${releases.rarityScore} DESC NULLS LAST`)
			.limit(500),

		// Records they own that I don't
		db
			.select(selectFields)
			.from(collectionItems)
			.innerJoin(releases, eq(releases.id, collectionItems.releaseId))
			.where(
				sql`${collectionItems.userId} = ${theirUserId}
					AND ${collectionItems.deletedAt} IS NULL
					AND NOT EXISTS (
						SELECT 1 FROM collection_items b
						WHERE b.user_id = ${myUserId}
						  AND b.release_id = ${collectionItems.releaseId}
						  AND b.deleted_at IS NULL
					)`,
			)
			.orderBy(sql`${releases.rarityScore} DESC NULLS LAST`)
			.limit(500),
	]);

	return { uniqueToMe, inCommon, uniqueToThem };
}
