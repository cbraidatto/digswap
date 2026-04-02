"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { follows, activityFeed } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import { collectionItems } from "@/lib/db/schema/collections";
import { eq, and, ilike, sql } from "drizzle-orm";
import { apiRateLimit } from "@/lib/rate-limit";
import {
	getGlobalFeed,
	getPersonalFeed,
	getFollowers,
	getFollowing,
	type FollowUser,
} from "@/lib/social/queries";
import {
	logActivitySchema,
	followUserSchema,
	loadMoreFeedSchema,
	userIdSchema,
	searchUsersSchema,
} from "@/lib/validations/social";

export interface FeedItem {
	id: string;
	userId: string;
	actionType: string;
	targetType: string | null;
	targetId: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	releaseGenre: string[] | null;
	releaseLabel: string | null;
	releaseCoverUrl: string | null;
	releaseRarityScore: number | null;
	releaseYoutubeVideoId: string | null;
}

export interface SearchResult {
	id: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	recordCount: number;
	followerCount: number;
	isFollowing: boolean;
}

export async function logActivity(
	userId: string,
	actionType: string,
	targetType: string | null,
	targetId: string | null,
	metadata: Record<string, unknown> | null,
): Promise<void> {
	try {
		const parsed = logActivitySchema.safeParse({ userId, actionType, targetType, targetId, metadata });
		if (!parsed.success) {
			return;
		}

		await db.insert(activityFeed).values({
			userId: parsed.data.userId,
			actionType: parsed.data.actionType,
			targetType: parsed.data.targetType,
			targetId: parsed.data.targetId,
			metadata: parsed.data.metadata,
		});
	} catch (err) {
		console.error("[logActivity] error:", err);
		// Non-blocking: activity logging failure should not crash the caller
	}
}

export async function followUser(
	targetUserId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = followUserSchema.safeParse({ targetUserId });
		if (!parsed.success) {
			return { error: "Invalid user ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		if (parsed.data.targetUserId === user.id) {
			return { error: "Cannot follow yourself" };
		}

		await db.insert(follows).values({
			followerId: user.id,
			followingId: parsed.data.targetUserId,
		});

		// Log activity
		const targetProfile = await db
			.select({ username: profiles.username })
			.from(profiles)
			.where(eq(profiles.id, parsed.data.targetUserId));

		await logActivity(user.id, "followed_user", "user", parsed.data.targetUserId, {
			username: targetProfile[0]?.username ?? null,
		});

		return { success: true };
	} catch {
		return { error: "Already following this user" };
	}
}

export async function unfollowUser(
	targetUserId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const parsed = followUserSchema.safeParse({ targetUserId });
		if (!parsed.success) {
			return { error: "Invalid user ID" };
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return { error: "Not authenticated" };
		}

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		await db
			.delete(follows)
			.where(
				and(
					eq(follows.followerId, user.id),
					eq(follows.followingId, parsed.data.targetUserId),
				),
			);

		return { success: true };
	} catch {
		return { error: "Could not unfollow user" };
	}
}

export async function loadMoreFeed(
	cursor: string | null,
	mode: "personal" | "global",
): Promise<FeedItem[]> {
	try {
		const parsed = loadMoreFeedSchema.safeParse({ cursor, mode });
		if (!parsed.success) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		if (parsed.data.mode === "personal") {
			return getPersonalFeed(user.id, parsed.data.cursor);
		}

		return getGlobalFeed(parsed.data.cursor);
	} catch (err) {
		console.error("[loadMoreFeed] error:", err);
		return [];
	}
}

export async function fetchFollowersList(
	userId: string,
): Promise<FollowUser[]> {
	try {
		const parsed = userIdSchema.safeParse({ userId });
		if (!parsed.success) {
			return [];
		}

		return await getFollowers(parsed.data.userId);
	} catch (err) {
		console.error("[fetchFollowersList] error:", err);
		return [];
	}
}

export async function fetchFollowingList(
	userId: string,
): Promise<FollowUser[]> {
	try {
		const parsed = userIdSchema.safeParse({ userId });
		if (!parsed.success) {
			return [];
		}

		return await getFollowing(parsed.data.userId);
	} catch (err) {
		console.error("[fetchFollowingList] error:", err);
		return [];
	}
}

export async function searchUsers(
	query: string,
): Promise<SearchResult[]> {
	try {
		const parsed = searchUsersSchema.safeParse({ query });
		if (!parsed.success) {
			return [];
		}

		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return [];
		}

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return [];
		}

		// Sanitize query to prevent SQL injection through ilike patterns
		const sanitized = parsed.data.query.replace(/[%_\\]/g, "\\$&");

		// Single query with subquery counts — eliminates N+1 (was 3 queries × 20 profiles)
		const matchingProfiles = await db
			.select({
				id: profiles.id,
				username: profiles.username,
				displayName: profiles.displayName,
				avatarUrl: profiles.avatarUrl,
				recordCount: sql<number>`coalesce((select count(*) from collection_items where user_id = ${profiles.id}), 0)`,
				followerCount: sql<number>`coalesce((select count(*) from follows where following_id = ${profiles.id}), 0)`,
				isFollowing: sql<boolean>`exists(select 1 from follows where follower_id = ${user.id} and following_id = ${profiles.id})`,
			})
			.from(profiles)
			.where(ilike(profiles.username, `%${sanitized}%`))
			.limit(20);

		return matchingProfiles.map((p) => ({
			id: p.id,
			username: p.username,
			displayName: p.displayName,
			avatarUrl: p.avatarUrl,
			recordCount: Number(p.recordCount),
			followerCount: Number(p.followerCount),
			isFollowing: Boolean(p.isFollowing),
		}));
	} catch (err) {
		console.error("[searchUsers] error:", err);
		return [];
	}
}
