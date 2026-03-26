"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { follows, activityFeed } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import { collectionItems } from "@/lib/db/schema/collections";
import { eq, and, ilike, sql } from "drizzle-orm";
import { getGlobalFeed, getPersonalFeed } from "@/lib/social/queries";

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
	await db.insert(activityFeed).values({
		userId,
		actionType,
		targetType,
		targetId,
		metadata,
	});
}

export async function followUser(
	targetUserId: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	if (targetUserId === user.id) {
		return { error: "Cannot follow yourself" };
	}

	try {
		await db.insert(follows).values({
			followerId: user.id,
			followingId: targetUserId,
		});

		// Log activity
		const targetProfile = await db
			.select({ username: profiles.username })
			.from(profiles)
			.where(eq(profiles.id, targetUserId));

		await logActivity(user.id, "followed_user", "user", targetUserId, {
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
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	try {
		await db
			.delete(follows)
			.where(
				and(
					eq(follows.followerId, user.id),
					eq(follows.followingId, targetUserId),
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
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return [];
	}

	if (mode === "personal") {
		return getPersonalFeed(user.id, cursor);
	}

	return getGlobalFeed(cursor);
}

export async function searchUsers(
	query: string,
): Promise<SearchResult[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return [];
	}

	const trimmed = query.trim();
	if (trimmed.length < 2) {
		return [];
	}

	// Sanitize query to prevent SQL injection through ilike patterns
	const sanitized = trimmed.replace(/[%_\\]/g, "\\$&");

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
}
