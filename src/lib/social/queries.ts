import { eq, and, sql, desc, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { follows, activityFeed } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import { releases } from "@/lib/db/schema/releases";
import type { FeedItem } from "@/actions/social";

export type FollowUser = {
	id: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
};

export async function getGlobalFeed(
	cursor: string | null,
	limit = 20,
): Promise<FeedItem[]> {
	const query = db
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
		})
		.from(activityFeed)
		.leftJoin(profiles, eq(activityFeed.userId, profiles.id))
		.leftJoin(releases, eq(activityFeed.targetId, releases.id))
		.where(
			cursor
				? and(lt(activityFeed.createdAt, new Date(cursor)))
				: undefined,
		)
		.orderBy(
			desc(sql`COALESCE(${releases.rarityScore}, -1)`),
			desc(activityFeed.createdAt),
		)
		.limit(limit);

	const rows = await query;

	return rows.map((row) => ({
		...row,
		createdAt:
			row.createdAt instanceof Date
				? row.createdAt.toISOString()
				: String(row.createdAt),
		metadata: row.metadata as Record<string, unknown> | null,
	}));
}

export async function getPersonalFeed(
	currentUserId: string,
	cursor: string | null,
	limit = 20,
): Promise<FeedItem[]> {
	const conditions = [
		sql`${activityFeed.userId} IN (SELECT ${follows.followingId} FROM ${follows} WHERE ${follows.followerId} = ${currentUserId})`,
	];

	if (cursor) {
		conditions.push(lt(activityFeed.createdAt, new Date(cursor)));
	}

	const query = db
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
		})
		.from(activityFeed)
		.leftJoin(profiles, eq(activityFeed.userId, profiles.id))
		.leftJoin(releases, eq(activityFeed.targetId, releases.id))
		.where(and(...conditions))
		.orderBy(desc(activityFeed.createdAt))
		.limit(limit);

	const rows = await query;

	return rows.map((row) => ({
		...row,
		createdAt:
			row.createdAt instanceof Date
				? row.createdAt.toISOString()
				: String(row.createdAt),
		metadata: row.metadata as Record<string, unknown> | null,
	}));
}

export async function getFollowCounts(
	userId: string,
): Promise<{ followingCount: number; followerCount: number }> {
	const followingResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(follows)
		.where(eq(follows.followerId, userId));

	const followerResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(follows)
		.where(eq(follows.followingId, userId));

	return {
		followingCount: Number(followingResult[0]?.count ?? 0),
		followerCount: Number(followerResult[0]?.count ?? 0),
	};
}

export async function getFollowers(
	userId: string,
	limit = 20,
	offset = 0,
): Promise<FollowUser[]> {
	const rows = await db
		.select({
			id: profiles.id,
			username: profiles.username,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
		})
		.from(follows)
		.innerJoin(profiles, eq(follows.followerId, profiles.id))
		.where(eq(follows.followingId, userId))
		.orderBy(desc(follows.createdAt))
		.limit(limit)
		.offset(offset);

	return rows;
}

export async function getFollowing(
	userId: string,
	limit = 20,
	offset = 0,
): Promise<FollowUser[]> {
	const rows = await db
		.select({
			id: profiles.id,
			username: profiles.username,
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
		})
		.from(follows)
		.innerJoin(profiles, eq(follows.followingId, profiles.id))
		.where(eq(follows.followerId, userId))
		.orderBy(desc(follows.createdAt))
		.limit(limit)
		.offset(offset);

	return rows;
}

export async function checkIsFollowing(
	currentUserId: string,
	targetUserId: string,
): Promise<boolean> {
	const rows = await db
		.select({ id: follows.id })
		.from(follows)
		.where(
			and(
				eq(follows.followerId, currentUserId),
				eq(follows.followingId, targetUserId),
			),
		);

	return rows.length > 0;
}

export async function getProgressBarState(
	userId: string,
): Promise<{ discogsConnected: boolean; followingCount: number }> {
	const profileResult = await db
		.select({ discogsConnected: profiles.discogsConnected })
		.from(profiles)
		.where(eq(profiles.id, userId));

	const followingResult = await db
		.select({ count: sql<number>`count(*)` })
		.from(follows)
		.where(eq(follows.followerId, userId));

	return {
		discogsConnected: profileResult[0]?.discogsConnected ?? false,
		followingCount: Number(followingResult[0]?.count ?? 0),
	};
}
