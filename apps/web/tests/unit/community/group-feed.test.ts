import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select",
		"from",
		"where",
		"orderBy",
		"limit",
		"innerJoin",
		"leftJoin",
		"groupBy",
		"offset",
	];

	for (const method of methods) {
		chain[method] = vi.fn().mockImplementation(() => chain);
	}

	// Thenable: resolves with the next result set
	chain.then = (resolve: (v: unknown) => void) => {
		const result = queryResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

// ---------------------------------------------------------------------------
// Schema mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/schema/groups", () => ({
	groups: {
		id: "id",
		creatorId: "creator_id",
		name: "name",
		slug: "slug",
		description: "description",
		category: "category",
		visibility: "visibility",
		memberCount: "member_count",
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
	groupMembers: {
		id: "id",
		groupId: "group_id",
		userId: "user_id",
		role: "role",
		joinedAt: "joined_at",
	},
	groupPosts: {
		id: "id",
		groupId: "group_id",
		userId: "user_id",
		content: "content",
		releaseId: "release_id",
		reviewId: "review_id",
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/group-invites", () => ({
	groupInvites: {
		id: "id",
		groupId: "group_id",
		token: "token",
		createdBy: "created_by",
		expiresAt: "expires_at",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/reviews", () => ({
	reviews: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		rating: "rating",
		title: "title",
		body: "body",
		isPressingSpecific: "is_pressing_specific",
		pressingDetails: "pressing_details",
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		avatarUrl: "avatar_url",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		label: "label",
		format: "format",
		year: "year",
		genre: "genre",
		rarityScore: "rarity_score",
		coverImageUrl: "cover_image_url",
	},
}));

// ---------------------------------------------------------------------------
// Import after mocks (queries, not actions -- no auth needed)
// ---------------------------------------------------------------------------
import { getGroupPosts } from "@/lib/community/queries";

describe("getGroupPosts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns posts ordered by createdAt desc", async () => {
		const now = new Date("2026-03-26T10:00:00Z");
		const earlier = new Date("2026-03-26T09:00:00Z");

		queryResults = [
			[
				{
					id: "post-1",
					userId: "user-1",
					username: "digger99",
					avatarUrl: null,
					content: "Latest find!",
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
					createdAt: now,
				},
				{
					id: "post-2",
					userId: "user-2",
					username: "jazzhound",
					avatarUrl: "https://example.com/avatar.jpg",
					content: "Old classic",
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
					createdAt: earlier,
				},
			],
		];

		const posts = await getGroupPosts("group-1");

		expect(posts).toHaveLength(2);
		expect(posts[0].id).toBe("post-1");
		expect(posts[1].id).toBe("post-2");
		// First post should be newer
		expect(new Date(posts[0].createdAt).getTime()).toBeGreaterThan(
			new Date(posts[1].createdAt).getTime(),
		);
	});

	test("applies cursor-based pagination (filter lt createdAt)", async () => {
		queryResults = [
			[
				{
					id: "post-3",
					userId: "user-1",
					username: "digger99",
					avatarUrl: null,
					content: "Older post",
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
					createdAt: new Date("2026-03-25T10:00:00Z"),
				},
			],
		];

		const posts = await getGroupPosts("group-1", "2026-03-26T10:00:00Z");

		expect(posts).toHaveLength(1);
		expect(posts[0].id).toBe("post-3");
	});

	test("joins with profiles for username", async () => {
		queryResults = [
			[
				{
					id: "post-1",
					userId: "user-1",
					username: "vinylmaster",
					avatarUrl: "https://example.com/img.jpg",
					content: "Great album",
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
					createdAt: new Date("2026-03-26T10:00:00Z"),
				},
			],
		];

		const posts = await getGroupPosts("group-1");

		expect(posts[0].username).toBe("vinylmaster");
		expect(posts[0].avatarUrl).toBe("https://example.com/img.jpg");
	});

	test("joins with releases for linked record info", async () => {
		queryResults = [
			[
				{
					id: "post-1",
					userId: "user-1",
					username: "digger99",
					avatarUrl: null,
					content: "Check this out!",
					releaseId: "rel-1",
					releaseTitle: "Kind of Blue",
					releaseArtist: "Miles Davis",
					releaseLabel: "Columbia",
					releaseYear: 1959,
					releaseFormat: "LP",
					releaseRarityScore: 1.5,
					reviewId: null,
					reviewRating: null,
					reviewIsPressingSpecific: null,
					reviewPressingDetails: null,
					createdAt: new Date("2026-03-26T10:00:00Z"),
				},
			],
		];

		const posts = await getGroupPosts("group-1");

		expect(posts[0].releaseTitle).toBe("Kind of Blue");
		expect(posts[0].releaseArtist).toBe("Miles Davis");
		expect(posts[0].releaseRarityScore).toBe(1.5);
	});

	test("joins with reviews for review rating", async () => {
		queryResults = [
			[
				{
					id: "post-1",
					userId: "user-1",
					username: "digger99",
					avatarUrl: null,
					content: "My review of this album",
					releaseId: "rel-1",
					releaseTitle: "Kind of Blue",
					releaseArtist: "Miles Davis",
					releaseLabel: "Columbia",
					releaseYear: 1959,
					releaseFormat: "LP",
					releaseRarityScore: 1.5,
					reviewId: "review-1",
					reviewRating: 5,
					reviewIsPressingSpecific: true,
					reviewPressingDetails: "Original 1959 mono pressing",
					createdAt: new Date("2026-03-26T10:00:00Z"),
				},
			],
		];

		const posts = await getGroupPosts("group-1");

		expect(posts[0].reviewId).toBe("review-1");
		expect(posts[0].reviewRating).toBe(5);
		expect(posts[0].reviewIsPressingSpecific).toBe(true);
		expect(posts[0].reviewPressingDetails).toBe("Original 1959 mono pressing");
	});
});
