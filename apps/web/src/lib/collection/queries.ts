import { unstable_cache } from "next/cache";
import { eq, desc, asc, and, gte, lt, sql, ilike, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import type { CollectionFilters } from "./filters";
import { getDecadeRange } from "./filters";

/** Number of items per page */
export const PAGE_SIZE = 24;

/** Shape returned by the collection query join */
export interface CollectionItem {
	id: string;
	conditionGrade: string | null;
	addedVia: string | null;
	createdAt: Date;
	releaseId: string;
	discogsId: number | null;
	title: string;
	artist: string;
	year: number | null;
	genre: string[] | null;
	format: string | null;
	coverImageUrl: string | null;
	rarityScore: number | null;
	youtubeVideoId: string | null;
	openForTrade: number;
	personalRating: number | null;
}

/**
 * Builds an array of WHERE conditions for collection queries.
 */
function buildWhereConditions(userId: string, filters: CollectionFilters) {
	const conditions = [eq(collectionItems.userId, userId)];

	if (filters.genre) {
		conditions.push(
			sql`${releases.genre} @> ARRAY[${filters.genre}]::text[]`,
		);
	}

	if (filters.decade) {
		const range = getDecadeRange(filters.decade);
		if (range) {
			conditions.push(gte(releases.year, range.start));
			conditions.push(lt(releases.year, range.end));
		}
	}

	if (filters.format) {
		conditions.push(eq(releases.format, filters.format));
	}

	if (filters.search) {
		const sanitized = filters.search.replace(/[%_\\]/g, "\\$&");
		const pattern = `%${sanitized}%`;
		conditions.push(
			or(
				ilike(releases.title, pattern),
				ilike(releases.artist, pattern),
			)!,
		);
	}

	return conditions;
}

/**
 * Returns the ORDER BY clause based on sort option.
 */
function buildOrderBy(sort: string) {
	switch (sort) {
		case "date":
			return desc(collectionItems.createdAt);
		case "alpha":
			return asc(releases.title);
		case "rating":
			return desc(sql`COALESCE(${collectionItems.personalRating}, 0)`);
		case "rarity":
		default:
			return desc(sql`COALESCE(${releases.rarityScore}, -1)`);
	}
}

/**
 * Fetches one page of a user's collection with release data joined.
 */
export async function getCollectionPage(
	userId: string,
	filters: CollectionFilters,
): Promise<CollectionItem[]> {
	const conditions = buildWhereConditions(userId, filters);
	const orderBy = buildOrderBy(filters.sort);

	// Base select fields (always available)
	const baseFields = {
		id: collectionItems.id,
		conditionGrade: collectionItems.conditionGrade,
		addedVia: collectionItems.addedVia,
		createdAt: collectionItems.createdAt,
		releaseId: releases.id,
		discogsId: releases.discogsId,
		title: releases.title,
		artist: releases.artist,
		year: releases.year,
		genre: releases.genre,
		format: releases.format,
		coverImageUrl: releases.coverImageUrl,
		rarityScore: releases.rarityScore,
		youtubeVideoId: releases.youtubeVideoId,
	};

	// Try with new columns first, fall back without them if migration not applied
	let rows: CollectionItem[];
	try {
		rows = await db
			.select({
				...baseFields,
				openForTrade: collectionItems.openForTrade,
				personalRating: collectionItems.personalRating,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(...conditions))
			.orderBy(orderBy)
			.limit(PAGE_SIZE)
			.offset((filters.page - 1) * PAGE_SIZE);
	} catch {
		// Fallback: columns don't exist yet (migration pending)
		const fallbackRows = await db
			.select(baseFields)
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(and(...conditions))
			.orderBy(orderBy)
			.limit(PAGE_SIZE)
			.offset((filters.page - 1) * PAGE_SIZE);
		rows = fallbackRows.map((r) => ({ ...r, openForTrade: 0, personalRating: null }));
	}

	return rows;
}

/**
 * Returns the total count of items matching the given filters.
 * Used for pagination calculations.
 */
export async function getCollectionCount(
	userId: string,
	filters: CollectionFilters,
): Promise<number> {
	const conditions = buildWhereConditions(userId, filters);

	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(and(...conditions));

	return Number(result[0]?.count ?? 0);
}

/**
 * Returns all unique genres across a user's collection.
 * Unnests the genre array column for distinct values.
 * Cached for 5 minutes — genres change only on import/removal.
 */
export const getUniqueGenres = unstable_cache(
	async (userId: string): Promise<string[]> => {
		const rows = await db
			.selectDistinct({
				genre: sql<string>`unnest(${releases.genre})`,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(eq(collectionItems.userId, userId));

		return rows.map((r) => r.genre).filter(Boolean).sort();
	},
	["collection-genres"],
	{ revalidate: 300, tags: ["collection"] },
);

/**
 * Returns the top N genres by record count in a user's collection.
 * Cached for 5 minutes.
 */
export const getTopGenres = unstable_cache(
	async (userId: string, limit = 3): Promise<{ genre: string; count: number }[]> => {
		const rows = await db
			.select({
				genre: sql<string>`unnest(${releases.genre})`,
				count: sql<number>`count(*)`,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(eq(collectionItems.userId, userId))
			.groupBy(sql`unnest(${releases.genre})`)
			.orderBy(sql`count(*) desc`)
			.limit(limit);

		return rows.map((r) => ({ genre: r.genre, count: Number(r.count) }));
	},
	["collection-top-genres"],
	{ revalidate: 300, tags: ["collection"] },
);

/**
 * Returns all unique formats across a user's collection.
 * Cached for 5 minutes — formats change only on import/removal.
 */
export const getUniqueFormats = unstable_cache(
	async (userId: string): Promise<string[]> => {
		const rows = await db
			.selectDistinct({
				format: releases.format,
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(eq(collectionItems.userId, userId));

		return rows
			.map((r) => r.format)
			.filter((f): f is string => f !== null)
			.sort();
	},
	["collection-formats"],
	{ revalidate: 300, tags: ["collection"] },
);
