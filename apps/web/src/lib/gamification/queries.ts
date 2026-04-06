import { cache } from "react";
import { eq, asc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userRankings, badges, userBadges } from "@/lib/db/schema/gamification";
import { profiles } from "@/lib/db/schema/users";

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
	userId: string;
	username: string | null;
	displayName: string | null;
	globalRank: number | null;
	title: string | null;
	globalScore: number;
}

export interface UserRanking {
	gemScore: number;
	contributionScore: number;
	globalRank: number | null;
	title: string | null;
}

export interface UserBadge {
	slug: string;
	name: string;
	description: string | null;
	earnedAt: Date;
}

// ---------------------------------------------------------------------------
// Global Leaderboard
// ---------------------------------------------------------------------------

export async function getGlobalLeaderboard(
	page = 1,
	pageSize = 50,
): Promise<LeaderboardEntry[]> {
	const offset = (page - 1) * pageSize;

	const rows = await db
		.select({
			userId: userRankings.userId,
			username: profiles.username,
			displayName: profiles.displayName,
			globalRank: userRankings.globalRank,
			title: userRankings.title,
			globalScore:
				sql<number>`${userRankings.rarityScore} * 0.7 + ${userRankings.contributionScore} * 0.3`,
		})
		.from(userRankings)
		.innerJoin(profiles, eq(userRankings.userId, profiles.id))
		.orderBy(asc(userRankings.globalRank))
		.limit(pageSize)
		.offset(offset);

	return rows.map((row) => ({
		...row,
		globalScore: Number(row.globalScore),
	}));
}

// ---------------------------------------------------------------------------
// Genre Leaderboard — reads from pre-aggregated materialized view
// Run `REFRESH MATERIALIZED VIEW CONCURRENTLY genre_leaderboard_mv` on a
// schedule (pg_cron or Supabase Edge Function, every 15 min) to keep fresh.
// ---------------------------------------------------------------------------

export async function getGenreLeaderboard(
	genre: string,
	page = 1,
	pageSize = 50,
): Promise<LeaderboardEntry[]> {
	const offset = (page - 1) * pageSize;

	// Query the materialized view instead of scanning collection_items × releases.
	// The MV pre-aggregates genre_score per user+genre; the index on (genre, genre_score DESC)
	// makes this a fast index scan instead of a full-table aggregation.
	const rows = await db.execute(sql`
		SELECT
			mv.user_id AS "userId",
			mv.username,
			mv.display_name AS "displayName",
			mv.genre_score AS "globalScore",
			ROW_NUMBER() OVER (ORDER BY mv.genre_score DESC) AS "globalRank",
			mv.title
		FROM genre_leaderboard_mv mv
		WHERE mv.genre = ${genre}
		ORDER BY mv.genre_score DESC
		LIMIT ${pageSize}
		OFFSET ${offset}
	`);

	return (rows as unknown as Record<string, unknown>[]).map((row) => ({
		userId: String(row.userId),
		username: row.username ? String(row.username) : null,
		displayName: row.displayName ? String(row.displayName) : null,
		globalRank: row.globalRank ? Number(row.globalRank) : null,
		title: row.title ? String(row.title) : null,
		globalScore: Number(row.globalScore ?? 0),
	}));
}

// ---------------------------------------------------------------------------
// User Ranking
// ---------------------------------------------------------------------------

export const getUserRanking = cache(async function getUserRanking(
	userId: string,
): Promise<UserRanking | null> {
	const rows = await db
		.select({
			rarityScore: userRankings.rarityScore,
			contributionScore: userRankings.contributionScore,
			globalRank: userRankings.globalRank,
			title: userRankings.title,
		})
		.from(userRankings)
		.where(eq(userRankings.userId, userId))
		.limit(1);

	if (rows.length === 0) return null;

	return {
		gemScore: rows[0].rarityScore, // DB column is rarity_score but value is now gem-weighted
		contributionScore: rows[0].contributionScore,
		globalRank: rows[0].globalRank,
		title: rows[0].title,
	};
});

// ---------------------------------------------------------------------------
// User Badges
// ---------------------------------------------------------------------------

export async function getUserBadges(userId: string): Promise<UserBadge[]> {
	const rows = await db
		.select({
			slug: badges.slug,
			name: badges.name,
			description: badges.description,
			earnedAt: userBadges.earnedAt,
		})
		.from(userBadges)
		.innerJoin(badges, eq(userBadges.badgeId, badges.id))
		.where(eq(userBadges.userId, userId))
		.orderBy(asc(userBadges.earnedAt));

	return rows;
}

// ---------------------------------------------------------------------------
// Counts (for pagination)
// ---------------------------------------------------------------------------

export async function getLeaderboardCount(): Promise<number> {
	const result = await db
		.select({ count: sql<number>`count(*)` })
		.from(userRankings);

	return Number(result[0]?.count ?? 0);
}

export async function getGenreLeaderboardCount(
	genre: string,
): Promise<number> {
	// Count from the materialized view — O(1) index lookup instead of full scan
	const result = await db.execute(sql`
		SELECT COUNT(*) AS count
		FROM genre_leaderboard_mv
		WHERE genre = ${genre}
	`);

	const rows = result as unknown as Record<string, unknown>[];
	return Number(rows[0]?.count ?? 0);
}
