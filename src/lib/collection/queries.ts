import { eq, desc, asc, and, gte, lt, sql } from "drizzle-orm";
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
		case "rarity":
		default:
			// COALESCE puts null rarity scores last (sorted as -1)
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

	const rows = await db
		.select({
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
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(and(...conditions))
		.orderBy(orderBy)
		.limit(PAGE_SIZE)
		.offset((filters.page - 1) * PAGE_SIZE);

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
 */
export async function getUniqueGenres(userId: string): Promise<string[]> {
	const rows = await db
		.selectDistinct({
			genre: sql<string>`unnest(${releases.genre})`,
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(eq(collectionItems.userId, userId));

	return rows.map((r) => r.genre).filter(Boolean).sort();
}

/**
 * Returns all unique formats across a user's collection.
 */
export async function getUniqueFormats(userId: string): Promise<string[]> {
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
}
