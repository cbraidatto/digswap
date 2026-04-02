import { eq, sql, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, activityFeed } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import { releases } from "@/lib/db/schema/releases";
import { diggerDna } from "@/lib/db/schema/engagement";
import type { FeedItem } from "@/actions/social";

export async function getExploreFeed(
	userId: string,
	cursor: string | null,
	limit = 20,
): Promise<FeedItem[]> {
	// 1. Fetch digger DNA top genres for this user
	const dnaRows = await db
		.select({ topGenres: diggerDna.topGenres })
		.from(diggerDna)
		.where(eq(diggerDna.userId, userId))
		.limit(1);

	const topGenres: string[] =
		dnaRows[0]?.topGenres?.map((g) => g.name) ?? [];

	// 2. Build exclusion list: user themselves + who they follow
	const followingRows = await db
		.select({ followingId: follows.followingId })
		.from(follows)
		.where(eq(follows.followerId, userId));

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

	const cursorExpr = cursor
		? sql`${activityFeed.createdAt} < ${new Date(cursor)}`
		: null;

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
		.orderBy(
			desc(sql`COALESCE(${releases.rarityScore}, -1)`),
			desc(activityFeed.createdAt),
		)
		.limit(limit);

	return rows.map((row) => {
		const rowGenres: string[] = row.releaseGenre ?? [];
		const hasDnaMatch =
			topGenres.length > 0 && rowGenres.some((g) => topGenres.includes(g));

		const contextReason: "dna_match" | "trending" = hasDnaMatch
			? "dna_match"
			: "trending";

		return {
			...row,
			createdAt:
				row.createdAt instanceof Date
					? row.createdAt.toISOString()
					: String(row.createdAt),
			metadata: row.metadata as Record<string, unknown> | null,
			contextReason,
		};
	});
}
