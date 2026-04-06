import { and, eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";

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
