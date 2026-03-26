"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { follows, activityFeed } from "@/lib/db/schema/social";
import { profiles } from "@/lib/db/schema/users";
import { eq, and } from "drizzle-orm";

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
	_cursor: string | null,
	_mode: "personal" | "global",
): Promise<FeedItem[]> {
	// Stub -- will be implemented in Task 2
	return [];
}

export async function searchUsers(
	_query: string,
): Promise<SearchResult[]> {
	// Stub -- will be implemented in Task 2
	return [];
}
