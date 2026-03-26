import { db } from "@/lib/db";
import { groups, groupMembers, groupPosts } from "@/lib/db/schema/groups";
import { reviews } from "@/lib/db/schema/reviews";
import { profiles } from "@/lib/db/schema/users";
import { eq, and, lt, desc, sql, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GenreGroup = {
	id: string;
	name: string;
	slug: string;
	category: string | null;
	memberCount: number;
};

export type MemberGroup = {
	id: string;
	name: string;
	slug: string;
	category: string | null;
	visibility: string;
	memberCount: number;
	createdAt: string;
	creatorUsername: string | null;
};

export type GroupPost = {
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
};

export type ReviewItem = {
	id: string;
	userId: string;
	username: string | null;
	avatarUrl: string | null;
	rating: number;
	title: string | null;
	body: string | null;
	isPressingSpecific: boolean;
	pressingDetails: string | null;
	createdAt: string;
};

// ---------------------------------------------------------------------------
// System user ID for genre groups
// ---------------------------------------------------------------------------

const SYSTEM_USER_ID =
	process.env.SYSTEM_USER_ID ?? "00000000-0000-0000-0000-000000000000";

// ---------------------------------------------------------------------------
// Group queries
// ---------------------------------------------------------------------------

export async function getGroupBySlug(slug: string) {
	const rows = await db
		.select()
		.from(groups)
		.where(eq(groups.slug, slug))
		.limit(1);
	return rows[0] ?? null;
}

export async function getGenreGroups(
	genreFilter?: string,
): Promise<GenreGroup[]> {
	const conditions = [eq(groups.creatorId, SYSTEM_USER_ID)];
	if (genreFilter) {
		conditions.push(eq(groups.category, genreFilter));
	}

	const rows = await db
		.select({
			id: groups.id,
			name: groups.name,
			slug: groups.slug,
			category: groups.category,
			memberCount: groups.memberCount,
		})
		.from(groups)
		.where(and(...conditions))
		.orderBy(desc(groups.memberCount));

	return rows.map((r) => ({
		...r,
		slug: r.slug ?? "",
	}));
}

export async function getMemberGroups(
	genreFilter?: string,
	cursor?: string,
	limit = 10,
): Promise<MemberGroup[]> {
	const conditions = [sql`${groups.creatorId} != ${SYSTEM_USER_ID}`];
	if (genreFilter) {
		conditions.push(eq(groups.category, genreFilter));
	}
	if (cursor) {
		conditions.push(lt(groups.createdAt, new Date(cursor)));
	}

	const rows = await db
		.select({
			id: groups.id,
			name: groups.name,
			slug: groups.slug,
			category: groups.category,
			visibility: groups.visibility,
			memberCount: groups.memberCount,
			createdAt: groups.createdAt,
			creatorUsername: profiles.username,
		})
		.from(groups)
		.leftJoin(profiles, eq(groups.creatorId, profiles.id))
		.where(and(...conditions))
		.orderBy(desc(groups.createdAt))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		slug: r.slug ?? "",
		createdAt: r.createdAt.toISOString(),
	}));
}

export async function getGroupMembershipState(
	groupId: string,
	userId: string,
): Promise<{ isMember: boolean; role: string | null }> {
	const rows = await db
		.select({ role: groupMembers.role })
		.from(groupMembers)
		.where(
			and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)),
		)
		.limit(1);

	if (rows.length === 0) return { isMember: false, role: null };
	return { isMember: true, role: rows[0].role };
}

export async function getGroupMemberCount(groupId: string): Promise<number> {
	const rows = await db
		.select({ count: count() })
		.from(groupMembers)
		.where(eq(groupMembers.groupId, groupId));
	return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Post queries
// ---------------------------------------------------------------------------

export async function getGroupPosts(
	groupId: string,
	cursor?: string,
	limit = 20,
): Promise<GroupPost[]> {
	const conditions = [eq(groupPosts.groupId, groupId)];
	if (cursor) {
		conditions.push(lt(groupPosts.createdAt, new Date(cursor)));
	}

	const rows = await db
		.select({
			id: groupPosts.id,
			userId: groupPosts.userId,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			content: groupPosts.content,
			createdAt: groupPosts.createdAt,
		})
		.from(groupPosts)
		.leftJoin(profiles, eq(groupPosts.userId, profiles.id))
		.where(and(...conditions))
		.orderBy(desc(groupPosts.createdAt))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		releaseId: null,
		releaseTitle: null,
		releaseArtist: null,
		releaseLabel: null,
		releaseYear: null,
		releaseFormat: null,
		releaseRarityScore: null,
		reviewId: null,
		reviewRating: null,
		reviewIsPressingSpecific: null,
		reviewPressingDetails: null,
		createdAt: r.createdAt.toISOString(),
	}));
}

// ---------------------------------------------------------------------------
// Review queries
// ---------------------------------------------------------------------------

export async function getReviewsForRelease(
	releaseId: string,
	cursor?: string,
	limit = 5,
): Promise<ReviewItem[]> {
	const conditions = [eq(reviews.releaseId, releaseId)];
	if (cursor) {
		conditions.push(lt(reviews.createdAt, new Date(cursor)));
	}

	const rows = await db
		.select({
			id: reviews.id,
			userId: reviews.userId,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			rating: reviews.rating,
			title: reviews.title,
			body: reviews.body,
			isPressingSpecific: reviews.isPressingSpecific,
			pressingDetails: reviews.pressingDetails,
			createdAt: reviews.createdAt,
		})
		.from(reviews)
		.leftJoin(profiles, eq(reviews.userId, profiles.id))
		.where(and(...conditions))
		.orderBy(desc(reviews.createdAt))
		.limit(limit);

	return rows.map((r) => ({
		...r,
		createdAt: r.createdAt.toISOString(),
	}));
}

export async function getReviewCountForRelease(
	releaseId: string,
): Promise<number> {
	const rows = await db
		.select({ count: count() })
		.from(reviews)
		.where(eq(reviews.releaseId, releaseId));
	return rows[0]?.count ?? 0;
}
