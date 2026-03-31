import { eq } from "drizzle-orm";
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
 * Build a matching key for a collection item.
 * Prefer discogsId when available; fall back to normalized artist+title.
 */
function getMatchKey(item: ComparisonItem): string {
	if (item.discogsId !== null && item.discogsId !== undefined) {
		return `discogs:${item.discogsId}`;
	}
	return `name:${item.artist.toLowerCase()}|||${item.title.toLowerCase()}`;
}

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

	const myItems: ComparisonItem[] = await db
		.select(selectFields)
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(eq(collectionItems.userId, myUserId));

	const theirItems: ComparisonItem[] = await db
		.select(selectFields)
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(eq(collectionItems.userId, theirUserId));

	// Safeguard: if either collection > 5000 items, return error-like empty result
	if (myItems.length > 5000 || theirItems.length > 5000) {
		return { uniqueToMe: [], inCommon: [], uniqueToThem: [] };
	}

	// Build key sets
	const myKeyMap = new Map<string, ComparisonItem>();
	for (const item of myItems) {
		myKeyMap.set(getMatchKey(item), item);
	}

	const theirKeyMap = new Map<string, ComparisonItem>();
	for (const item of theirItems) {
		theirKeyMap.set(getMatchKey(item), item);
	}

	const uniqueToMe: ComparisonItem[] = [];
	const inCommon: ComparisonItem[] = [];
	const uniqueToThem: ComparisonItem[] = [];

	// Items in my collection
	for (const [key, item] of myKeyMap) {
		if (theirKeyMap.has(key)) {
			inCommon.push(item);
		} else {
			uniqueToMe.push(item);
		}
	}

	// Items only in their collection
	for (const [key, item] of theirKeyMap) {
		if (!myKeyMap.has(key)) {
			uniqueToThem.push(item);
		}
	}

	return { uniqueToMe, inCommon, uniqueToThem };
}
