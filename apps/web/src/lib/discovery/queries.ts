import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { collectionItems } from "@/lib/db/schema/collections";
import { profiles } from "@/lib/db/schema/users";
import { follows } from "@/lib/db/schema/social";
import { getDecadeRange } from "@/lib/collection/filters";
import {
	sql,
	eq,
	or,
	and,
	ilike,
	desc,
	gte,
	inArray,
	isNull,
	ne,
	count,
	countDistinct,
} from "drizzle-orm";

export interface RecordOwner {
	releaseId: string;
	userId: string;
	username: string | null;
	avatarUrl: string | null;
	conditionGrade: string | null;
}

export interface SearchResult {
	id: string;
	discogsId: number | null;
	title: string;
	artist: string;
	label: string | null;
	format: string | null;
	year: number | null;
	genre: string[] | null;
	rarityScore: number | null;
	coverImageUrl: string | null;
	owners: RecordOwner[];
	ownerCount: number;
}

export interface BrowseResult {
	id: string;
	discogsId: number | null;
	title: string;
	artist: string;
	label: string | null;
	format: string | null;
	year: number | null;
	genre: string[] | null;
	rarityScore: number | null;
	coverImageUrl: string | null;
	ownerCount: number;
	isOwned?: boolean;
}

export interface SuggestionResult {
	id: string;
	discogsId: number | null;
	title: string;
	artist: string;
	label: string | null;
	format: string | null;
	year: number | null;
	genre: string[] | null;
	rarityScore: number | null;
	coverImageUrl: string | null;
	ownerCount: number;
}

/**
 * Search records by title or artist across all releases in the database.
 * Returns matching releases with their owners (users who have them in collections).
 *
 * Per DISC2-01: Search across all user collections to find who has a specific record.
 */
export async function searchRecords(
	term: string,
	limit = 20,
): Promise<SearchResult[]> {
	const trimmed = term.trim();
	if (!trimmed) return [];

	// Sanitize term: escape %, _, \ to prevent LIKE injection
	const sanitized = trimmed.replace(/[%_\\]/g, "\\$&");
	const pattern = `%${sanitized}%`;

	// Query matching releases
	const matchingReleases = await db
		.select({
			id: releases.id,
			discogsId: releases.discogsId,
			title: releases.title,
			artist: releases.artist,
			label: releases.label,
			format: releases.format,
			year: releases.year,
			genre: releases.genre,
			rarityScore: releases.rarityScore,
			coverImageUrl: releases.coverImageUrl,
		})
		.from(releases)
		.where(
			or(
				ilike(releases.title, pattern),
				ilike(releases.artist, pattern),
			),
		)
		.orderBy(desc(sql`COALESCE(${releases.rarityScore}, -1)`))
		.limit(limit);

	if (matchingReleases.length === 0) return [];

	// Collect release IDs
	const releaseIds = matchingReleases.map((r) => r.id);

	// Batch query owners for all matched releases
	const ownerRows = await db
		.select({
			releaseId: collectionItems.releaseId,
			userId: collectionItems.userId,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			conditionGrade: collectionItems.conditionGrade,
		})
		.from(collectionItems)
		.innerJoin(profiles, eq(collectionItems.userId, profiles.id))
		.where(inArray(collectionItems.releaseId, releaseIds));

	// Group owners by releaseId
	const ownersByRelease = new Map<string, RecordOwner[]>();
	for (const row of ownerRows) {
		const rid = row.releaseId!;
		if (!ownersByRelease.has(rid)) {
			ownersByRelease.set(rid, []);
		}
		ownersByRelease.get(rid)!.push({
			releaseId: rid,
			userId: row.userId,
			username: row.username,
			avatarUrl: row.avatarUrl,
			conditionGrade: row.conditionGrade,
		});
	}

	return matchingReleases.map((r) => {
		const owners = ownersByRelease.get(r.id) ?? [];
		return {
			...r,
			owners,
			ownerCount: owners.length,
		};
	});
}

/**
 * Browse records by genre and/or decade across all user collections.
 * Only returns records that exist in at least one user's collection.
 *
 * Per DISC2-02: Genre/decade browse returns cross-user records filtered by genre array and year range.
 * Extended in S03: also supports multi-genre, country, format, minRarity filters.
 */
export async function browseRecords(
	genre: string | null,
	decade: string | null,
	limit = 20,
	offset = 0,
	genres: string[] = [],
	country: string | null = null,
	format: string | null = null,
	minRarity = 0,
	styles: string[] = [],
	label: string | null = null,
	sort = "rarity",
	yearFrom: number | null = null,
	yearTo: number | null = null,
	userId: string | null = null,
): Promise<BrowseResult[]> {
	// Build WHERE conditions
	const conditions = [];

	// Legacy single-genre filter (kept for backward compat)
	if (genre) {
		conditions.push(
			sql`${releases.genre} @> ARRAY[${genre}]::text[]`,
		);
	}

	// Multi-genre filter (any of): combine with OR
	if (genres.length > 0) {
		const genreConditions = genres.map(
			(g) => sql`${releases.genre} @> ARRAY[${g}]::text[]`,
		);
		conditions.push(or(...genreConditions)!);
	}

	if (decade) {
		const range = getDecadeRange(decade);
		if (range) {
			conditions.push(
				and(
					sql`${releases.year} >= ${range.start}`,
					sql`${releases.year} < ${range.end}`,
				)!,
			);
		}
	}

	// Style filter (any of): combine with OR on style array
	if (styles.length > 0) {
		const styleConditions = styles.map(
			(s) => sql`${releases.style} @> ARRAY[${s}]::text[]`,
		);
		conditions.push(or(...styleConditions)!);
	}

	if (country) {
		conditions.push(ilike(releases.country, `%${country}%`));
	}

	if (label) {
		const sanitizedLabel = label.replace(/[%_\\]/g, "\\$&");
		conditions.push(ilike(releases.label, `%${sanitizedLabel}%`));
	}

	if (format) {
		conditions.push(ilike(releases.format, `%${format}%`));
	}

	if (yearFrom) {
		conditions.push(sql`${releases.year} >= ${yearFrom}`);
	}

	if (yearTo) {
		conditions.push(sql`${releases.year} <= ${yearTo}`);
	}

	if (minRarity > 0) {
		// rarityScore is stored 0-1 range or 0-100 depending on compute — treat as 0-1, scale input
		conditions.push(
			sql`COALESCE(${releases.rarityScore}, 0) >= ${minRarity / 100}`,
		);
	}

	// Inner join with collection_items to only show records in at least one collection
	const rows = await db
		.select({
			id: releases.id,
			discogsId: releases.discogsId,
			title: releases.title,
			artist: releases.artist,
			label: releases.label,
			format: releases.format,
			year: releases.year,
			genre: releases.genre,
			rarityScore: releases.rarityScore,
			coverImageUrl: releases.coverImageUrl,
			ownerCount: countDistinct(collectionItems.userId).as("owner_count"),
			...(userId
				? {
						isOwned: sql<boolean>`bool_or(${collectionItems.userId} = ${userId})`.as(
							"is_owned",
						),
					}
				: {}),
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.groupBy(
			releases.id,
			releases.discogsId,
			releases.title,
			releases.artist,
			releases.label,
			releases.format,
			releases.year,
			releases.genre,
			releases.rarityScore,
			releases.coverImageUrl,
		)
		.orderBy(
			sort === "year" ? desc(sql`COALESCE(${releases.year}, 0)`)
			: sort === "alpha" ? sql`${releases.title} ASC`
			: sort === "owners" ? desc(sql`count(DISTINCT ${collectionItems.userId})`)
			: desc(sql`COALESCE(${releases.rarityScore}, -1)`),
		)
		.limit(limit)
		.offset(offset);

	return rows.map((r) => ({
		...r,
		ownerCount: Number(r.ownerCount),
		isOwned: "isOwned" in r ? Boolean(r.isOwned) : false,
	}));
}

/**
 * Get suggested records for a user based on their taste (top genres)
 * and records from users they follow.
 *
 * Per DISC2-04: Recommendation engine based on collection taste and
 * what similar diggers have.
 */
export async function getSuggestedRecords(
	userId: string,
	limit = 8,
): Promise<SuggestionResult[]> {
	// Step 1: Get user's top 3 genres from their collection
	const topGenres = await db
		.select({
			genre: sql<string>`unnest(${releases.genre})`.as("genre"),
			genreCount: count().as("genre_count"),
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(eq(collectionItems.userId, userId))
		.groupBy(sql`unnest(${releases.genre})`)
		.orderBy(desc(sql`genre_count`))
		.limit(3);

	const genreNames = topGenres.map((g) => g.genre);

	// NOT EXISTS subquery to exclude owned records — avoids transferring IDs to Node.js
	const notOwnedExpr = sql`NOT EXISTS (
		SELECT 1 FROM collection_items ci_owned
		WHERE ci_owned.user_id = ${userId}
		  AND ci_owned.release_id = ${releases.id}
	)`;

	// Step 3: Genre-based suggestions -- records in user's top genres they don't own
	let genreSuggestions: SuggestionResult[] = [];
	if (genreNames.length > 0) {
		const genreConditions = genreNames.map(
			(g) => sql`${releases.genre} @> ARRAY[${g}]::text[]`,
		);

		const genreQuery = db
			.select({
				id: releases.id,
				discogsId: releases.discogsId,
				title: releases.title,
				artist: releases.artist,
				label: releases.label,
				format: releases.format,
				year: releases.year,
				genre: releases.genre,
				rarityScore: releases.rarityScore,
				coverImageUrl: releases.coverImageUrl,
				ownerCount: countDistinct(collectionItems.userId).as("owner_count"),
			})
			.from(releases)
			.innerJoin(collectionItems, eq(collectionItems.releaseId, releases.id))
			.where(
				and(
					or(...genreConditions),
					notOwnedExpr,
					ne(collectionItems.userId, userId),
				),
			)
			.groupBy(
				releases.id,
				releases.discogsId,
				releases.title,
				releases.artist,
				releases.label,
				releases.format,
				releases.year,
				releases.genre,
				releases.rarityScore,
				releases.coverImageUrl,
			)
			.orderBy(desc(sql`COALESCE(${releases.rarityScore}, -1)`))
			.limit(limit);

		const rows = await genreQuery;
		genreSuggestions = rows.map((r) => ({
			...r,
			ownerCount: Number(r.ownerCount),
		}));
	}

	// Step 4: Followed users' records the current user does not own
	const followedUsers = await db
		.select({ followingId: follows.followingId })
		.from(follows)
		.where(eq(follows.followerId, userId));

	const followedIds = followedUsers.map((f) => f.followingId);

	let followSuggestions: SuggestionResult[] = [];
	if (followedIds.length > 0) {
		const followQuery = db
			.select({
				id: releases.id,
				discogsId: releases.discogsId,
				title: releases.title,
				artist: releases.artist,
				label: releases.label,
				format: releases.format,
				year: releases.year,
				genre: releases.genre,
				rarityScore: releases.rarityScore,
				coverImageUrl: releases.coverImageUrl,
				ownerCount: countDistinct(collectionItems.userId).as("owner_count"),
			})
			.from(collectionItems)
			.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
			.where(
				and(
					inArray(collectionItems.userId, followedIds),
					notOwnedExpr,
				),
			)
			.groupBy(
				releases.id,
				releases.discogsId,
				releases.title,
				releases.artist,
				releases.label,
				releases.format,
				releases.year,
				releases.genre,
				releases.rarityScore,
				releases.coverImageUrl,
			)
			.orderBy(desc(sql`COALESCE(${releases.rarityScore}, -1)`))
			.limit(limit);

		const rows = await followQuery;
		followSuggestions = rows.map((r) => ({
			...r,
			ownerCount: Number(r.ownerCount),
		}));
	}

	// Step 5: Merge and deduplicate
	const seen = new Set<string>();
	const merged: SuggestionResult[] = [];

	for (const item of [...genreSuggestions, ...followSuggestions]) {
		if (!seen.has(item.id)) {
			seen.add(item.id);
			merged.push(item);
		}
		if (merged.length >= limit) break;
	}

	return merged;
}

// ---------------------------------------------------------------------------
// Trending records — most added to collections in the last 7 days
// ---------------------------------------------------------------------------

export interface TrendingRecord {
	id: string;
	discogsId: number | null;
	title: string;
	artist: string;
	coverImageUrl: string | null;
	rarityScore: number | null;
	addCount: number;
}

/**
 * Get records most frequently added to collections in the last 7 days.
 */
export async function getTrendingRecords(limit = 10): Promise<TrendingRecord[]> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const rows = await db
		.select({
			id: releases.id,
			discogsId: releases.discogsId,
			title: releases.title,
			artist: releases.artist,
			coverImageUrl: releases.coverImageUrl,
			rarityScore: releases.rarityScore,
			addCount: count(collectionItems.id).as("add_count"),
		})
		.from(collectionItems)
		.innerJoin(releases, eq(collectionItems.releaseId, releases.id))
		.where(gte(collectionItems.createdAt, sevenDaysAgo))
		.groupBy(
			releases.id,
			releases.discogsId,
			releases.title,
			releases.artist,
			releases.coverImageUrl,
			releases.rarityScore,
		)
		.orderBy(desc(sql`add_count`))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		addCount: Number(r.addCount),
	}));
}
