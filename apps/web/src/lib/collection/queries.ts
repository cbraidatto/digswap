import { and, asc, desc, eq, gte, ilike, lt, ne, or, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
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
	notes: string | null;
	openForTrade: number;
	personalRating: number | null;
	tracklist: { position: string; title: string; duration: string }[] | null;
	visibility: string;
	audioFormat: string | null;
	bitrate: number | null;
	sampleRate: number | null;
}

/**
 * Builds an array of WHERE conditions for collection queries.
 */
function buildWhereConditions(userId: string, filters: CollectionFilters) {
	const conditions = [eq(collectionItems.userId, userId)];

	if (filters.genre) {
		conditions.push(sql`${releases.genre} @> ARRAY[${filters.genre}]::text[]`);
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
		conditions.push(or(ilike(releases.title, pattern), ilike(releases.artist, pattern))!);
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
			// Falls back to rarity if personal_rating column doesn't exist yet
			return desc(sql`COALESCE(${releases.rarityScore}, -1)`);
		default:
			return desc(sql`COALESCE(${releases.rarityScore}, -1)`);
	}
}

/**
 * Options for collection page queries.
 */
export interface CollectionPageOptions {
	/** When true, excludes items with visibility='private' (for public profile views) */
	excludePrivate?: boolean;
}

/**
 * Fetches one page of a user's collection with release data joined.
 */
export async function getCollectionPage(
	userId: string,
	filters: CollectionFilters,
	options?: CollectionPageOptions,
): Promise<CollectionItem[]> {
	const conditions = buildWhereConditions(userId, filters);
	const orderBy = buildOrderBy(filters.sort);

	// Defense-in-depth: exclude private items for public profile views
	if (options?.excludePrivate) {
		conditions.push(ne(collectionItems.visibility, "private"));
	}

	const selectFields = {
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
		notes: collectionItems.notes,
		tracklist: releases.tracklist,
		openForTrade: collectionItems.openForTrade,
		personalRating: collectionItems.personalRating,
		visibility: collectionItems.visibility,
		audioFormat: collectionItems.audioFormat,
		bitrate: collectionItems.bitrate,
		sampleRate: collectionItems.sampleRate,
	};

	const baseRows = await db
		.select(selectFields)
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(and(...conditions))
		.orderBy(orderBy)
		.limit(PAGE_SIZE)
		.offset((filters.page - 1) * PAGE_SIZE);

	const rows: CollectionItem[] = baseRows.map((r) => ({
		...r,
		notes: r.notes ?? null,
		openForTrade: r.openForTrade ?? 0,
		personalRating: r.personalRating ?? null,
		visibility: r.visibility ?? "not_trading",
		audioFormat: r.audioFormat ?? null,
		bitrate: r.bitrate ?? null,
		sampleRate: r.sampleRate ?? null,
		tracklist: Array.isArray(r.tracklist)
			? (r.tracklist as { position: string; title: string; duration: string }[])
			: null,
	}));

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

		return rows
			.map((r) => r.genre)
			.filter(Boolean)
			.sort();
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
