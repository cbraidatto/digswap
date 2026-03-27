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
	rarityScore: number;
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
// Genre Leaderboard
// ---------------------------------------------------------------------------

export async function getGenreLeaderboard(
	genre: string,
	page = 1,
	pageSize = 50,
): Promise<LeaderboardEntry[]> {
	const offset = (page - 1) * pageSize;

	const rows = await db.execute(sql`
		SELECT
			ci.user_id AS "userId",
			p.username,
			p.display_name AS "displayName",
			SUM(LN(1 + COALESCE(r.rarity_score, 0))) AS "globalScore",
			ROW_NUMBER() OVER (ORDER BY SUM(LN(1 + COALESCE(r.rarity_score, 0))) DESC) AS "globalRank",
			ur.title
		FROM collection_items ci
		INNER JOIN releases r ON r.id = ci.release_id
		INNER JOIN profiles p ON p.id = ci.user_id
		LEFT JOIN user_rankings ur ON ur.user_id = ci.user_id
		WHERE r.genre @> ARRAY[${genre}]::text[]
		GROUP BY ci.user_id, p.username, p.display_name, ur.title
		ORDER BY "globalScore" DESC
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

export async function getUserRanking(
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

	return rows[0];
}

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
	const result = await db.execute(sql`
		SELECT COUNT(DISTINCT ci.user_id) AS count
		FROM collection_items ci
		INNER JOIN releases r ON r.id = ci.release_id
		WHERE r.genre @> ARRAY[${genre}]::text[]
	`);

	const rows = result as unknown as Record<string, unknown>[];
	return Number(rows[0]?.count ?? 0);
}
