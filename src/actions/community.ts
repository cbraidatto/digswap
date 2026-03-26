"use server";

import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { groups, groupMembers, groupPosts } from "@/lib/db/schema/groups";
import { reviews } from "@/lib/db/schema/reviews";
import { profiles } from "@/lib/db/schema/users";
import { eq, and, sql } from "drizzle-orm";
import {
	getGroupPosts,
	type GroupPost,
} from "@/lib/community/queries";

export async function joinGroupAction(
	groupId: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	try {
		// Check if already a member
		const existing = await db
			.select()
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (existing.length > 0) {
			return { error: "Already a member" };
		}

		// Add as member
		await db.insert(groupMembers).values({
			groupId,
			userId: user.id,
			role: "member",
		});

		// Increment member count
		await db
			.update(groups)
			.set({ memberCount: sql`${groups.memberCount} + 1` })
			.where(eq(groups.id, groupId));

		return { success: true };
	} catch {
		return { error: "Failed to join group" };
	}
}

export async function leaveGroupAction(
	groupId: string,
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
			.delete(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			);

		// Decrement member count
		await db
			.update(groups)
			.set({ memberCount: sql`GREATEST(${groups.memberCount} - 1, 0)` })
			.where(eq(groups.id, groupId));

		return { success: true };
	} catch {
		return { error: "Failed to leave group" };
	}
}

export async function createPostAction(data: {
	groupId: string;
	content: string;
	releaseId?: string;
}): Promise<{ id: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	const result = await db
		.insert(groupPosts)
		.values({
			groupId: data.groupId,
			userId: user.id,
			content: data.content,
		})
		.returning({ id: groupPosts.id });

	return { id: result[0].id };
}

export async function createReviewAction(data: {
	groupId: string;
	releaseId: string;
	rating: number;
	body: string;
	title?: string;
	isPressingSpecific: boolean;
	pressingDetails?: string;
}): Promise<{ id: string; postId: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	// Create review
	const reviewResult = await db
		.insert(reviews)
		.values({
			userId: user.id,
			releaseId: data.releaseId,
			rating: data.rating,
			title: data.title ?? null,
			body: data.body,
			isPressingSpecific: data.isPressingSpecific,
			pressingDetails: data.pressingDetails ?? null,
		})
		.returning({ id: reviews.id });

	// Create group post linking to the review
	const postResult = await db
		.insert(groupPosts)
		.values({
			groupId: data.groupId,
			userId: user.id,
			content: data.body,
		})
		.returning({ id: groupPosts.id });

	return { id: reviewResult[0].id, postId: postResult[0].id };
}

export async function loadGroupPostsAction(
	groupId: string,
	cursor?: string,
): Promise<GroupPost[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return getGroupPosts(groupId, cursor);
}

export async function generateInviteAction(
	groupId: string,
): Promise<{ token: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	// Generate a random token
	const token = crypto.randomUUID();

	// In production, store in group_invites table
	// For now, return the generated token
	return { token };
}

export async function inviteUserAction(
	groupId: string,
	username: string,
): Promise<{ success?: boolean; error?: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	// Look up user by username
	const targetUser = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	if (targetUser.length === 0) {
		return { error: "User not found" };
	}

	// Check if already a member
	const existing = await db
		.select()
		.from(groupMembers)
		.where(
			and(
				eq(groupMembers.groupId, groupId),
				eq(groupMembers.userId, targetUser[0].id),
			),
		)
		.limit(1);

	if (existing.length > 0) {
		return { error: "User is already a member" };
	}

	// In production, create notification for the invited user
	return { success: true };
}

export async function acceptInviteAction(
	token: string,
): Promise<{ slug: string } | { error: string }> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { error: "Not authenticated" };
	}

	// In production, validate token against group_invites table
	// For now, return error as invite infrastructure needs Plan 01 migration
	return { error: "Invalid invite token" };
}
