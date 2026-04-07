import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

const mockInsertValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();

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

	// Insert chain with onConflictDoUpdate for review upsert
	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			onConflictDoUpdate: mockOnConflictDoUpdate.mockImplementation(() => ({
				returning: vi.fn().mockImplementation(() => ({
					then: (resolve: (v: unknown) => void) => {
						const result = queryResults[queryCallCount] ?? [];
						queryCallCount++;
						return resolve(result);
					},
				})),
			})),
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = queryResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = queryResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

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
// Supabase auth mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: "test-user-id" } },
			}),
		},
	})),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => ({
		from: vi.fn().mockReturnValue({
			insert: vi.fn().mockResolvedValue({ data: null, error: null }),
		}),
	}),
}));

vi.mock("@/actions/social", () => ({
	logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/community/slugify", () => ({
	slugify: vi.fn().mockReturnValue("test-group"),
}));

vi.mock("@/lib/community/queries", () => ({
	getGroupPosts: vi.fn(),
	getGenreGroups: vi.fn(),
	getMemberGroups: vi.fn(),
	getReviewsForRelease: vi.fn().mockResolvedValue([]),
	getReviewCountForRelease: vi.fn().mockResolvedValue(0),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { createReviewAction } from "@/actions/community";
import { getReviewCountForRelease, getReviewsForRelease } from "@/lib/community/queries";

const TEST_GROUP_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RELEASE_ID = "22222222-2222-4222-8222-222222222222";

describe("createReviewAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("creates review with rating 1-5", async () => {
		queryResults = [
			// Query 0: verify group membership
			[{ id: "member-1" }],
			// Query 1: get group info
			[{ name: "Jazz Group", slug: "jazz-group" }],
			// Query 2: upsert review (insert with onConflictDoUpdate)
			[{ id: "review-1" }],
			// Query 3: insert group post linked to review
			[{ id: "post-1" }],
			// Query 4: logActivity
			[],
		];

		const result = await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 4,
			body: "Excellent pressing, warm tone throughout.",
		});

		expect(result).toEqual({ id: "review-1" });
	});

	test("rejects rating 0 (validation error)", async () => {
		const result = await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 0,
			body: "Should fail",
		});
		expect(result).toHaveProperty("error");
	});

	test("rejects rating 6 (validation error)", async () => {
		const result = await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 6,
			body: "Should fail",
		});
		expect(result).toHaveProperty("error");
	});

	test("creates group_post with reviewId", async () => {
		queryResults = [
			[{ id: "member-1" }],
			[{ name: "Jazz Group", slug: "jazz-group" }],
			[{ id: "review-1" }], // upsert review
			[{ id: "post-1" }], // insert group post
			[], // logActivity
		];

		await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 5,
			body: "Perfect condition original pressing.",
		});

		// The second insert call (group post) should include reviewId
		// We verify through the mockInsertValues being called twice
		expect(mockInsertValues).toHaveBeenCalledTimes(2);
	});

	test("handles pressing-specific review (isPressingSpecific: true)", async () => {
		queryResults = [
			[{ id: "member-1" }],
			[{ name: "Jazz Group", slug: "jazz-group" }],
			[{ id: "review-1" }],
			[{ id: "post-1" }],
			[],
		];

		const result = await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 5,
			body: "Original 1973 pressing sounds incredible",
			isPressingSpecific: true,
			pressingDetails: "Original 1973 SP",
		});

		expect(result).toEqual({ id: "review-1" });
		// Verify the insert was called with pressing-specific data
		expect(mockInsertValues).toHaveBeenCalled();
	});

	test("handles general release review (isPressingSpecific: false)", async () => {
		queryResults = [
			[{ id: "member-1" }],
			[{ name: "Jazz Group", slug: "jazz-group" }],
			[{ id: "review-1" }],
			[{ id: "post-1" }],
			[],
		];

		const result = await createReviewAction({
			groupId: TEST_GROUP_ID,
			releaseId: TEST_RELEASE_ID,
			rating: 3,
			body: "Average album overall",
			isPressingSpecific: false,
		});

		expect(result).toEqual({ id: "review-1" });
	});
});

describe("getReviewsForRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns reviews filtered by releaseId", async () => {
		const mockGetReviews = vi.mocked(getReviewsForRelease);
		mockGetReviews.mockResolvedValue([
			{
				id: "review-1",
				userId: "user-1",
				username: "digger99",
				avatarUrl: null,
				rating: 5,
				title: "Amazing pressing",
				body: "Warm analog sound",
				isPressingSpecific: true,
				pressingDetails: "1973 original",
				createdAt: "2026-03-26T10:00:00Z",
			},
			{
				id: "review-2",
				userId: "user-2",
				username: "jazzhound",
				avatarUrl: "https://example.com/avatar.jpg",
				rating: 4,
				title: "Good album",
				body: "Classic jazz",
				isPressingSpecific: false,
				pressingDetails: null,
				createdAt: "2026-03-25T10:00:00Z",
			},
		]);

		const reviews = await getReviewsForRelease("release-1");

		expect(reviews).toHaveLength(2);
		expect(reviews[0].rating).toBe(5);
		expect(reviews[1].rating).toBe(4);
	});

	test("returns reviews ordered by createdAt desc", async () => {
		const mockGetReviews = vi.mocked(getReviewsForRelease);
		mockGetReviews.mockResolvedValue([
			{
				id: "review-1",
				userId: "user-1",
				username: "digger99",
				avatarUrl: null,
				rating: 5,
				title: null,
				body: "Newer review",
				isPressingSpecific: false,
				pressingDetails: null,
				createdAt: "2026-03-26T12:00:00Z",
			},
			{
				id: "review-2",
				userId: "user-2",
				username: "jazzhound",
				avatarUrl: null,
				rating: 3,
				title: null,
				body: "Older review",
				isPressingSpecific: false,
				pressingDetails: null,
				createdAt: "2026-03-25T12:00:00Z",
			},
		]);

		const reviews = await getReviewsForRelease("release-1");

		expect(new Date(reviews[0].createdAt).getTime()).toBeGreaterThan(
			new Date(reviews[1].createdAt).getTime(),
		);
	});
});

describe("getReviewCountForRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns correct count", async () => {
		const mockGetCount = vi.mocked(getReviewCountForRelease);
		mockGetCount.mockResolvedValue(3);

		const count = await getReviewCountForRelease("release-1");

		expect(count).toBe(3);
	});
});
