import { db } from "@/lib/db";
import { groups, groupMembers, groupPosts } from "@/lib/db/schema/groups";
import { reviews } from "@/lib/db/schema/reviews";
import { profiles } from "@/lib/db/schema/users";
import { releases } from "@/lib/db/schema/releases";
import { eq, and, desc, lt, sql } from "drizzle-orm";

export interface Group {
	id: string;
	name: string;
	slug: string;
	category: string | null;
	visibility: string;
	description: string | null;
	memberCount: number;
	creatorId: string;
	createdAt: string;
}

export interface GroupPost {
	id: string;
	userId: string;
	username: string | null;
	avatarUrl: string | null;
	content: string;
	releaseId: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	releaseLabel: string | null;
	releaseYear: number | null;
	releaseFormat: string | null;
	releaseRarityScore: number | null;
	reviewId: string | null;
	reviewRating: number | null;
	reviewIsPressingSpecific: boolean | null;
	reviewPressingDetails: string | null;
	createdAt: string;
}

export async function getGroupBySlug(slug: string): Promise<Group | null> {
	// Query groups table - slug is derived from name
	// In production this queries the groups table with a slug column or name-based lookup
	const result = await db
		.select()
		.from(groups)
		.where(
			eq(
				sql`lower(replace(replace(${groups.name}, ' ', '-'), '''', ''))`,
				slug.toLowerCase(),
			),
		)
		.limit(1);

	if (result.length === 0) return null;

	const g = result[0];
	return {
		id: g.id,
		name: g.name,
		slug: slug,
		category: g.category,
		visibility: g.visibility,
		description: g.description,
		memberCount: g.memberCount,
		creatorId: g.creatorId,
		createdAt: g.createdAt.toISOString(),
	};
}

export async function getGroupMembershipState(
	groupId: string,
	userId: string,
): Promise<{ isMember: boolean; role: string | null }> {
	const result = await db
		.select({ role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
		)
		.limit(1);

	if (result.length === 0) {
		return { isMember: false, role: null };
	}

	return { isMember: true, role: result[0].role };
}

export async function getGroupPosts(
	groupId: string,
	cursor?: string | null,
	limit = 20,
): Promise<GroupPost[]> {
	const conditions = [eq(groupPosts.groupId, groupId)];

	if (cursor) {
		conditions.push(lt(groupPosts.createdAt, new Date(cursor)));
	}

	const result = await db
		.select({
			id: groupPosts.id,
			userId: groupPosts.userId,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			content: groupPosts.content,
			releaseId: sql<string | null>`null`.as("release_id_col"),
			releaseTitle: sql<string | null>`null`.as("release_title"),
			releaseArtist: sql<string | null>`null`.as("release_artist"),
			releaseLabel: sql<string | null>`null`.as("release_label"),
			releaseYear: sql<number | null>`null`.as("release_year"),
			releaseFormat: sql<string | null>`null`.as("release_format"),
			releaseRarityScore: sql<number | null>`null`.as("release_rarity_score"),
			reviewId: sql<string | null>`null`.as("review_id"),
			reviewRating: sql<number | null>`null`.as("review_rating"),
			reviewIsPressingSpecific: sql<boolean | null>`null`.as(
				"review_is_pressing_specific",
			),
			reviewPressingDetails: sql<string | null>`null`.as(
				"review_pressing_details",
			),
			createdAt: groupPosts.createdAt,
		})
		.from(groupPosts)
		.innerJoin(profiles, eq(profiles.id, groupPosts.userId))
		.where(and(...conditions))
		.orderBy(desc(groupPosts.createdAt))
		.limit(limit);

	return result.map((r) => ({
		...r,
		createdAt: r.createdAt.toISOString(),
	}));
}

export async function getInviteByToken(
	token: string,
): Promise<{
	groupId: string;
	groupName: string;
	groupSlug: string;
	memberCount: number;
	visibility: string;
	createdBy: string;
} | null> {
	// This will be implemented with the group_invites table
	// For now returns null as the table needs to be created by Plan 01
	return null;
}
