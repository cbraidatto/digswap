"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { groups, groupMembers, groupPosts } from "@/lib/db/schema/groups";
import { groupInvites } from "@/lib/db/schema/group-invites";
import { reviews } from "@/lib/db/schema/reviews";
import { profiles } from "@/lib/db/schema/users";
import { eq, and, sql } from "drizzle-orm";
import { logActivity } from "@/actions/social";
import { awardBadge } from "@/lib/gamification/badge-awards";
import { apiRateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/community/slugify";
import { createPostSchema, createReviewSchema } from "@/lib/validations/community";
import {
	getGroupPosts,
	getGenreGroups,
	getMemberGroups,
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

async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

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
}): Promise<{ slug: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const name = data.name.trim();
		if (!name || name.length === 0) {
			return { error: "Group name is required." };
		}
		if (name.length > 80) {
			return { error: "Group name must be 80 characters or fewer." };
		}

		// Generate slug with conflict resolution
		let baseSlug = slugify(name);
		let candidateSlug = baseSlug;
		let suffix = 2;

		// eslint-disable-next-line no-constant-condition
		while (true) {
			const existing = await db
				.select({ id: groups.id })
				.from(groups)
				.where(eq(groups.slug, candidateSlug))
				.limit(1);

			if (existing.length === 0) break;

			candidateSlug = `${baseSlug}-${suffix}`;
			suffix++;
		}

		// Insert group
		const [group] = await db
			.insert(groups)
			.values({
				creatorId: user.id,
				name,
				slug: candidateSlug,
				description: data.description ?? null,
				category: data.category ?? null,
				visibility: data.visibility,
				memberCount: 1,
			})
			.returning({ id: groups.id, slug: groups.slug });

		// Insert creator as admin member
		await db.insert(groupMembers).values({
			groupId: group.id,
			userId: user.id,
			role: "admin",
		});

		return { slug: group.slug };
	} catch (err) {
		console.error("[createGroupAction] error:", err);
		return { error: "Failed to create group. Please try again." };
	}
}

export async function joinGroupAction(
	groupId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Check group exists
		const [group] = await db
			.select({
				id: groups.id,
				name: groups.name,
				slug: groups.slug,
				visibility: groups.visibility,
			})
			.from(groups)
			.where(eq(groups.id, groupId))
			.limit(1);

		if (!group) {
			return { error: "Group not found." };
		}

		// Check not already a member
		const existingMember = await db
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (existingMember.length > 0) {
			return { error: "Already a member of this group." };
		}

		// For private groups, block direct join — must use acceptInviteAction with a valid token
		if (group.visibility === "private") {
			return { error: "This is a private group. You need an invite link to join." };
		}

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

		// Log activity
		await logActivity(user.id, "joined_group", "group", groupId, {
			groupName: group.name,
			groupSlug: group.slug,
		});

		// Badge check: CREW_MEMBER (Phase 8, GAME-04)
		try {
			await awardBadge(user.id, "crew_member");
		} catch {
			// Non-blocking
		}

		return { success: true };
	} catch (err) {
		console.error("[joinGroupAction] error:", err);
		return { error: "Failed to join group. Please try again." };
	}
}

export async function leaveGroupAction(
	groupId: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Check membership
		const [membership] = await db
			.select({ id: groupMembers.id, role: groupMembers.role })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (!membership) {
			return { error: "Not a member of this group." };
		}

		// If admin, check there's at least one other admin
		if (membership.role === "admin") {
			const otherAdmins = await db
				.select({ id: groupMembers.id })
				.from(groupMembers)
				.where(
					and(
						eq(groupMembers.groupId, groupId),
						eq(groupMembers.role, "admin"),
					),
				);

			if (otherAdmins.length <= 1) {
				return {
					error:
						"Cannot leave as the sole admin. Promote another member first.",
				};
			}
		}

		// Remove member
		await db
			.delete(groupMembers)
			.where(eq(groupMembers.id, membership.id));

		// Decrement member count
		await db
			.update(groups)
			.set({ memberCount: sql`${groups.memberCount} - 1` })
			.where(eq(groups.id, groupId));

		return { success: true };
	} catch (err) {
		console.error("[leaveGroupAction] error:", err);
		return { error: "Failed to leave group. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function createPostAction(data: {
	groupId: string;
	content: string;
	releaseId?: string;
}): Promise<{ id: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = createPostSchema.safeParse(data);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid post data" };
		}

		const content = parsed.data.content;
		if (!content) {
			return { error: "Post content cannot be empty." };
		}

		// Verify group membership
		const [membership] = await db
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, data.groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (!membership) {
			return { error: "You must be a member of this group to post." };
		}

		// Get group info for activity metadata
		const [group] = await db
			.select({ name: groups.name, slug: groups.slug })
			.from(groups)
			.where(eq(groups.id, data.groupId))
			.limit(1);

		// Insert post
		const [post] = await db
			.insert(groupPosts)
			.values({
				groupId: data.groupId,
				userId: user.id,
				content,
				releaseId: data.releaseId ?? null,
			})
			.returning({ id: groupPosts.id });

		// Log activity
		await logActivity(user.id, "group_post", "group_post", post.id, {
			groupId: data.groupId,
			groupName: group?.name ?? null,
			groupSlug: group?.slug ?? null,
			content: content.slice(0, 200),
			releaseId: data.releaseId ?? null,
		});

		return { id: post.id };
	} catch (err) {
		console.error("[createPostAction] error:", err);
		return { error: "Failed to create post. Please try again." };
	}
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
}): Promise<{ id: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = createReviewSchema.safeParse({
			releaseId: data.releaseId,
			rating: data.rating,
			body: data.body,
			title: data.title,
			groupId: data.groupId,
		});
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid review data" };
		}

		// Validate rating
		const rating = parsed.data.rating;
		if (rating < 1 || rating > 5) {
			return { error: "Rating must be between 1 and 5." };
		}

		if (!data.releaseId) {
			return { error: "Release ID is required for a review." };
		}

		// Verify group membership
		const [membership] = await db
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, data.groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (!membership) {
			return { error: "You must be a member of this group to post a review." };
		}

		// Get group info
		const [group] = await db
			.select({ name: groups.name, slug: groups.slug })
			.from(groups)
			.where(eq(groups.id, data.groupId))
			.limit(1);

		// Upsert review (one review per user per release)
		const [review] = await db
			.insert(reviews)
			.values({
				userId: user.id,
				releaseId: data.releaseId,
				rating,
				title: data.title ?? null,
				body: data.body,
				isPressingSpecific: data.isPressingSpecific ?? false,
				pressingDetails: data.pressingDetails ?? null,
			})
			.onConflictDoUpdate({
				target: [reviews.userId, reviews.releaseId],
				set: {
					rating,
					title: data.title ?? null,
					body: data.body,
					isPressingSpecific: data.isPressingSpecific ?? false,
					pressingDetails: data.pressingDetails ?? null,
					updatedAt: new Date(),
				},
			})
			.returning({ id: reviews.id });

		// Create group post linked to review
		await db.insert(groupPosts).values({
			groupId: data.groupId,
			userId: user.id,
			content: data.body,
			releaseId: data.releaseId,
			reviewId: review.id,
		});

		// Log activity
		await logActivity(user.id, "wrote_review", "review", review.id, {
			groupId: data.groupId,
			groupName: group?.name ?? null,
			groupSlug: group?.slug ?? null,
			releaseId: data.releaseId,
			rating,
		});

		// Badge check: CRITIC (Phase 8, GAME-04)
		try {
			await awardBadge(user.id, "critic");
		} catch {
			// Non-blocking
		}

		return { id: review.id };
	} catch (err) {
		console.error("[createReviewAction] error:", err);
		return { error: "Failed to create review. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export async function generateInviteAction(
	groupId: string,
): Promise<{ token: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Verify user is admin of group
		const [membership] = await db
			.select({ role: groupMembers.role })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (!membership || membership.role !== "admin") {
			return { error: "Only group admins can generate invite links." };
		}

		const token = crypto.randomUUID();

		await db.insert(groupInvites).values({
			groupId,
			token,
			createdBy: user.id,
		});

		return { token };
	} catch (err) {
		console.error("[generateInviteAction] error:", err);
		return { error: "Failed to generate invite. Please try again." };
	}
}

export async function inviteUserAction(
	groupId: string,
	username: string,
): Promise<{ success?: boolean; error?: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Verify admin
		const [membership] = await db
			.select({ role: groupMembers.role })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (!membership || membership.role !== "admin") {
			return { error: "Only group admins can invite users." };
		}

		// Get group info
		const [group] = await db
			.select({ name: groups.name, slug: groups.slug })
			.from(groups)
			.where(eq(groups.id, groupId))
			.limit(1);

		if (!group) {
			return { error: "Group not found." };
		}

		// Look up target user by username
		const [targetUser] = await db
			.select({ id: profiles.id })
			.from(profiles)
			.where(eq(profiles.username, username))
			.limit(1);

		if (!targetUser) {
			return { error: "User not found." };
		}

		// Get inviter username
		const [inviterProfile] = await db
			.select({ username: profiles.username })
			.from(profiles)
			.where(eq(profiles.id, user.id))
			.limit(1);

		const inviterUsername = inviterProfile?.username ?? "Someone";

		// Insert notification via admin client (bypasses RLS)
		const admin = createAdminClient();
		await admin.from("notifications").insert({
			user_id: targetUser.id,
			type: "group_invite",
			title: `You've been invited to join ${group.name}`,
			body: `${inviterUsername} invited you to the group "${group.name}"`,
			link: `/comunidade/${group.slug}`,
		});

		return { success: true };
	} catch (err) {
		console.error("[inviteUserAction] error:", err);
		return { error: "Failed to invite user. Please try again." };
	}
}

export async function acceptInviteAction(
	token: string,
): Promise<{ slug: string } | { error: string }> {
	try {
		const user = await requireUser();

		const { success: rlSuccess } = await apiRateLimit.limit(user.id);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		// Look up invite
		const [invite] = await db
			.select({
				groupId: groupInvites.groupId,
				expiresAt: groupInvites.expiresAt,
			})
			.from(groupInvites)
			.where(eq(groupInvites.token, token))
			.limit(1);

		if (!invite) {
			return { error: "Invite not found or invalid." };
		}

		// Check expiration
		if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
			return { error: "This invite has expired." };
		}

		// Check not already member
		const existingMember = await db
			.select({ id: groupMembers.id })
			.from(groupMembers)
			.where(
				and(
					eq(groupMembers.groupId, invite.groupId),
					eq(groupMembers.userId, user.id),
				),
			)
			.limit(1);

		if (existingMember.length > 0) {
			// Already a member -- just return the group slug
			const [group] = await db
				.select({ slug: groups.slug })
				.from(groups)
				.where(eq(groups.id, invite.groupId))
				.limit(1);

			return { slug: group?.slug ?? "" };
		}

		// Insert member
		await db.insert(groupMembers).values({
			groupId: invite.groupId,
			userId: user.id,
			role: "member",
		});

		// Increment member count
		await db
			.update(groups)
			.set({ memberCount: sql`${groups.memberCount} + 1` })
			.where(eq(groups.id, invite.groupId));

		// Get group slug for redirect
		const [group] = await db
			.select({ slug: groups.slug })
			.from(groups)
			.where(eq(groups.id, invite.groupId))
			.limit(1);

		return { slug: group?.slug ?? "" };
	} catch (err) {
		console.error("[acceptInviteAction] error:", err);
		return { error: "Failed to accept invite. Please try again." };
	}
}

// ---------------------------------------------------------------------------
// Feed query wrappers (for UI server actions)
// ---------------------------------------------------------------------------

export async function loadGroupPostsAction(
	groupId: string,
	cursor?: string,
): Promise<GroupPost[]> {
	try {
		const user = await requireUser();

		// Verify membership for private groups
		const [group] = await db
			.select({ visibility: groups.visibility })
			.from(groups)
			.where(eq(groups.id, groupId))
			.limit(1);

		if (group?.visibility === "private") {
			const [membership] = await db
				.select({ id: groupMembers.id })
				.from(groupMembers)
				.where(
					and(
						eq(groupMembers.groupId, groupId),
						eq(groupMembers.userId, user.id),
					),
				)
				.limit(1);

			if (!membership) {
				return []; // Not a member of this private group
			}
		}

		return getGroupPosts(groupId, cursor);
	} catch (err) {
		console.error("[loadGroupPostsAction] error:", err);
		return [];
	}
}

export async function loadGenreGroupsAction(
	genreFilter?: string,
): Promise<GenreGroup[]> {
	try {
		await requireUser();
		return getGenreGroups(genreFilter);
	} catch (err) {
		console.error("[loadGenreGroupsAction] error:", err);
		return [];
	}
}

export async function loadMemberGroupsAction(
	genreFilter?: string,
	cursor?: string,
): Promise<MemberGroup[]> {
	try {
		await requireUser();
		return getMemberGroups(genreFilter, cursor);
	} catch (err) {
		console.error("[loadMemberGroupsAction] error:", err);
		return [];
	}
}

export async function loadReviewsForReleaseAction(
	releaseId: string,
	cursor?: string,
): Promise<ReviewItem[]> {
	try {
		await requireUser();
		return getReviewsForRelease(releaseId, cursor);
	} catch (err) {
		console.error("[loadReviewsForReleaseAction] error:", err);
		return [];
	}
}

export async function getReviewCountAction(
	releaseId: string,
): Promise<number> {
	try {
		await requireUser();
		return getReviewCountForRelease(releaseId);
	} catch (err) {
		console.error("[getReviewCountAction] error:", err);
		return 0;
	}
}
