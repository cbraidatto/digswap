import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { diggerDna } from "@/lib/db/schema/engagement";
import { releases } from "@/lib/db/schema/releases";
import { searchSignals } from "@/lib/db/schema/search-signals";
import { activityFeed, follows } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import type { FeedItem } from "@/lib/social/types";

export async function getExploreFeed(
	userId: string,
	cursor: string | null,
	limit = 20,
): Promise<FeedItem[]> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	// Parallelize all preflight queries — was 3 sequential round trips
	const [dnaRows, signalRows, followingRows] = await Promise.all([
		db
			.select({ topGenres: diggerDna.topGenres })
			.from(diggerDna)
			.where(eq(diggerDna.userId, userId))
			.limit(1),
		db
			.select({ genres: searchSignals.genres, strength: searchSignals.strength })
			.from(searchSignals)
			.where(
				and(eq(searchSignals.userId, userId), gt(searchSignals.lastReinforcedAt, sevenDaysAgo)),
			)
			.limit(1),
		db
			.select({ followingId: follows.followingId })
			.from(follows)
			.where(eq(follows.followerId, userId)),
	]);

	const dnaGenres: string[] = dnaRows[0]?.topGenres?.map((g) => g.name) ?? [];
	// Signal genres get a boost by appearing first (affects contextReason matching)
	const signalGenres = signalRows[0]?.genres ?? [];
	const topGenres = [...new Set([...signalGenres, ...dnaGenres])];

	const excludedIds = [userId, ...followingRows.map((r) => r.followingId)];

	// 3. Compose WHERE as a single sql`` expression that Drizzle can accept
	// We build the parts and AND them together manually to avoid the
	// and(...undefined) pitfall with optional genre filtering.
	const excludeExpr = sql`${activityFeed.userId} != ALL(
		ARRAY[${sql.join(
			excludedIds.map((id) => sql`${id}::uuid`),
			sql`, `,
		)}]
	)`;

	const genreExpr =
		topGenres.length > 0
			? sql`(
				${releases.genre} && ARRAY[${sql.join(
					topGenres.map((g) => sql`${g}`),
					sql`, `,
				)}]::text[]
				OR ${releases.style} && ARRAY[${sql.join(
					topGenres.map((g) => sql`${g}`),
					sql`, `,
				)}]::text[]
			)`
			: null;

	const cursorExpr = cursor ? sql`${activityFeed.createdAt} < ${new Date(cursor)}` : null;

	// Build combined where expression
	let whereExpr = excludeExpr;
	if (genreExpr) {
		whereExpr = sql`${whereExpr} AND ${genreExpr}`;
	}
	if (cursorExpr) {
		whereExpr = sql`${whereExpr} AND ${cursorExpr}`;
	}

	const rows = await db
		.select({
			id: activityFeed.id,
			userId: activityFeed.userId,
			actionType: activityFeed.actionType,
			targetType: activityFeed.targetType,
			targetId: activityFeed.targetId,
			metadata: activityFeed.metadata,
			createdAt: activityFeed.createdAt,
			username: profiles.username,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			releaseTitle: releases.title,
			releaseArtist: releases.artist,
			releaseGenre: releases.genre,
			releaseLabel: releases.label,
			releaseCoverUrl: releases.coverImageUrl,
			releaseRarityScore: releases.rarityScore,
			releaseYoutubeVideoId: releases.youtubeVideoId,
		})
		.from(activityFeed)
		.leftJoin(profiles, eq(activityFeed.userId, profiles.id))
		.leftJoin(releases, eq(activityFeed.targetId, releases.id))
		.where(whereExpr)
		.orderBy(desc(sql`COALESCE(${releases.rarityScore}, -1)`), desc(activityFeed.createdAt))
		.limit(limit);

	return rows.map((row) => {
		const rowGenres: string[] = row.releaseGenre ?? [];
		const hasSignalMatch =
			signalGenres.length > 0 && rowGenres.some((g) => signalGenres.includes(g));
		const hasDnaMatch = dnaGenres.length > 0 && rowGenres.some((g) => dnaGenres.includes(g));

		const contextReason: "dna_match" | "trending" =
			hasSignalMatch || hasDnaMatch ? "dna_match" : "trending";

		return {
			...row,
			createdAt:
				row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
			metadata: row.metadata as Record<string, unknown> | null,
			contextReason,
		};
	});
}
