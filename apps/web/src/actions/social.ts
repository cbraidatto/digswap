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

		const matchingProfiles = await db
			.select({
				id: profiles.id,
				username: profiles.username,
				displayName: profiles.displayName,
				avatarUrl: profiles.avatarUrl,
			})
			.from(profiles)
			.where(ilike(profiles.username, `%${sanitized}%`))
			.limit(20);

		// Enrich each profile with counts
		const results: SearchResult[] = [];
		for (const profile of matchingProfiles) {
			const recordCountResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(collectionItems)
				.where(eq(collectionItems.userId, profile.id));

			const followerCountResult = await db
				.select({ count: sql<number>`count(*)` })
				.from(follows)
				.where(eq(follows.followingId, profile.id));

			const isFollowingResult = await db
				.select({ id: follows.id })
				.from(follows)
				.where(
					and(
						eq(follows.followerId, user.id),
						eq(follows.followingId, profile.id),
					),
				);

			results.push({
				id: profile.id,
				username: profile.username,
				displayName: profile.displayName,
				avatarUrl: profile.avatarUrl,
				recordCount: Number(recordCountResult[0]?.count ?? 0),
				followerCount: Number(followerCountResult[0]?.count ?? 0),
				isFollowing: isFollowingResult.length > 0,
			});
		}

		return results;
	} catch (err) {
		console.error("[searchUsers] error:", err);
		return [];
	}
}
