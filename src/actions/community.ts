"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { groups, groupMembers, groupPosts } from "@/lib/db/schema/groups";
import { reviews } from "@/lib/db/schema/reviews";
import { profiles } from "@/lib/db/schema/users";
import { eq, and, sql } from "drizzle-orm";
import { slugify } from "@/lib/community/slugify";
import { logActivity } from "@/actions/social";
import {
	getGenreGroups,
	getMemberGroups,
	getGroupPosts,
	getReviewsForRelease,
	getReviewCountForRelease,
	type GenreGroup,
	type MemberGroup,
	type GroupPost,
	type ReviewItem,
} from "@/lib/community/queries";

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAuth() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Not authenticated");
	return user;
}

// ---------------------------------------------------------------------------
// Group CRUD
// ---------------------------------------------------------------------------

export async function createGroupAction(data: {
	name: string;
	description?: string;
	category?: string;
	visibility: "public" | "private";
}): Promise<{ slug: string }> {
	const user = await requireAuth();

	const name = data.name.trim();
	if (!name || name.length === 0) throw new Error("GROUP_NAME_REQUIRED");
	if (name.length > 80) throw new Error("NAME_TOO_LONG (max 80 chars)");

	let slug = slugify(name);
	// Ensure slug uniqueness
	let suffix = 1;
	let existing = await db
		.select({ id: groups.id })
		.from(groups)
		.where(eq(groups.slug, slug))
		.limit(1);
	while (existing.length > 0) {
		suffix++;
		slug = `${slugify(name)}-${suffix}`;
		existing = await db
			.select({ id: groups.id })
			.from(groups)
			.where(eq(groups.slug, slug))
			.limit(1);
	}

	const [group] = await db
		.insert(groups)
		.values({
			creatorId: user.id,
			name,
			slug,
			description: data.description ?? null,
			category: data.category ?? null,
			visibility: data.visibility,
			memberCount: 1,
		})
		.returning({ id: groups.id, slug: groups.slug });

	// Add creator as admin member
	await db.insert(groupMembers).values({
		groupId: group.id,
		userId: user.id,
		role: "admin",
	});

	return { slug: group.slug ?? slug };
}

export async function joinGroupAction(
	groupId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireAuth();

	// Check group exists
	const [group] = await db
		.select()
		.from(groups)
		.where(eq(groups.id, groupId))
		.limit(1);
	if (!group) return { error: "Group not found." };

	// Check not already member
	const [existingMember] = await db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
		)
		.limit(1);
	if (existingMember) return { error: "Already a member." };

	// Insert member
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

	await logActivity(user.id, "joined_group", "group", groupId, {
		groupName: group.name,
		groupSlug: group.slug,
	});

	return { success: true };
}

export async function leaveGroupAction(
	groupId: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireAuth();

	const [member] = await db
		.select({ id: groupMembers.id, role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
		)
		.limit(1);
	if (!member) return { error: "Not a member." };

	// Check not sole admin
	if (member.role === "admin") {
		const [otherAdmin] = await db
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.role, "admin"),
					sql`${groupMembers.userId} != ${user.id}`,
				),
			)
			.limit(1);
		if (!otherAdmin)
			return { error: "Cannot leave as sole admin. Transfer admin first." };
	}

	await db
		.delete(groupMembers)
		.where(eq(groupMembers.id, member.id));

	await db
		.update(groups)
		.set({ memberCount: sql`${groups.memberCount} - 1` })
		.where(eq(groups.id, groupId));

	return { success: true };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function createPostAction(data: {
	groupId: string;
	content: string;
	releaseId?: string;
}): Promise<{ id: string }> {
	const user = await requireAuth();

	if (!data.content.trim()) throw new Error("Content is required.");

	// Check membership
	const [member] = await db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(
			and(
				eq(groupMembers.groupId, data.groupId),
				eq(groupMembers.userId, user.id),
			),
		)
		.limit(1);
	if (!member) throw new Error("Must be a member to post.");

	const [group] = await db
		.select({ name: groups.name, slug: groups.slug })
		.from(groups)
		.where(eq(groups.id, data.groupId))
		.limit(1);

	const [post] = await db
		.insert(groupPosts)
		.values({
			groupId: data.groupId,
			userId: user.id,
			content: data.content,
		})
		.returning({ id: groupPosts.id });

	await logActivity(user.id, "group_post", "group_post", post.id, {
		groupId: data.groupId,
		groupName: group?.name,
		groupSlug: group?.slug,
		content: data.content.slice(0, 200),
		releaseId: data.releaseId ?? null,
	});

	return { id: post.id };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function createReviewAction(data: {
	groupId: string;
	releaseId: string;
	rating: number;
	body: string;
	title?: string;
	isPressingSpecific?: boolean;
	pressingDetails?: string;
}): Promise<{ id: string }> {
	const user = await requireAuth();

	if (data.rating < 1 || data.rating > 5 || !Number.isInteger(data.rating)) {
		throw new Error("Rating must be an integer between 1 and 5.");
	}

	// Check membership
	const [member] = await db
		.select({ id: groupMembers.id })
		.from(groupMembers)
		.where(
			and(
				eq(groupMembers.groupId, data.groupId),
				eq(groupMembers.userId, user.id),
			),
		)
		.limit(1);
	if (!member) throw new Error("Must be a member to review.");

	const [group] = await db
		.select({ name: groups.name, slug: groups.slug })
		.from(groups)
		.where(eq(groups.id, data.groupId))
		.limit(1);

	// Upsert review
	const [review] = await db
		.insert(reviews)
		.values({
			userId: user.id,
			releaseId: data.releaseId,
			rating: data.rating,
			title: data.title ?? null,
			body: data.body,
			isPressingSpecific: data.isPressingSpecific ?? false,
			pressingDetails: data.pressingDetails ?? null,
		})
		.onConflictDoNothing()
		.returning({ id: reviews.id });

	const reviewId = review?.id;

	// Create group post for the review
	await db.insert(groupPosts).values({
		groupId: data.groupId,
		userId: user.id,
		content: data.body,
	});

	await logActivity(user.id, "wrote_review", "review", reviewId ?? "", {
		groupId: data.groupId,
		groupName: group?.name,
		groupSlug: group?.slug,
		releaseId: data.releaseId,
		rating: data.rating,
	});

	return { id: reviewId ?? "" };
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function generateInviteAction(
	groupId: string,
): Promise<{ token: string }> {
	const user = await requireAuth();

	const [member] = await db
		.select({ role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
		)
		.limit(1);
	if (!member || member.role !== "admin")
		throw new Error("Only admins can generate invites.");

	const token = crypto.randomUUID();
	// Note: groupInvites table insert would go here once schema is ready
	return { token };
}

export async function inviteUserAction(
	groupId: string,
	username: string,
): Promise<{ success?: boolean; error?: string }> {
	const user = await requireAuth();

	const [member] = await db
		.select({ role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, user.id)),
		)
		.limit(1);
	if (!member || member.role !== "admin")
		return { error: "Only admins can invite." };

	const [target] = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);
	if (!target) return { error: "User not found." };

	return { success: true };
}

export async function acceptInviteAction(
	token: string,
): Promise<{ slug: string } | { error: string }> {
	// Token-based invite acceptance -- requires groupInvites table
	return { error: "Invite system not yet configured." };
}

// ---------------------------------------------------------------------------
// Feed queries (for UI)
// ---------------------------------------------------------------------------

export async function loadGenreGroupsAction(
	genreFilter?: string,
): Promise<GenreGroup[]> {
	await requireAuth();
	return getGenreGroups(genreFilter);
}

export async function loadMemberGroupsAction(
	genreFilter?: string,
	cursor?: string,
): Promise<MemberGroup[]> {
	await requireAuth();
	return getMemberGroups(genreFilter, cursor);
}

export async function loadGroupPostsAction(
	groupId: string,
	cursor?: string,
): Promise<GroupPost[]> {
	await requireAuth();
	return getGroupPosts(groupId, cursor);
}

export async function loadReviewsForReleaseAction(
	releaseId: string,
	cursor?: string,
): Promise<ReviewItem[]> {
	await requireAuth();
	return getReviewsForRelease(releaseId, cursor);
}

export async function getReviewCountAction(
	releaseId: string,
): Promise<number> {
	await requireAuth();
	return getReviewCountForRelease(releaseId);
}
