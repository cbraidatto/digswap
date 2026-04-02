import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

const mockInsertValues = vi.fn();

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

	// Insert chain
	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
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
	getReviewsForRelease: vi.fn(),
	getReviewCountForRelease: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { createPostAction } from "@/actions/community";
import { logActivity } from "@/actions/social";

const TEST_GROUP_ID = "11111111-1111-4111-8111-111111111111";
const TEST_RELEASE_ID = "22222222-2222-4222-8222-222222222222";

describe("createPostAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("creates post with text content", async () => {
		queryResults = [
			// Query 0: verify group membership
			[{ id: "member-1" }],
			// Query 1: get group info
			[{ name: "Jazz Group", slug: "jazz-group" }],
			// Query 2: insert post
			[{ id: "post-1" }],
			// Query 3: logActivity (void)
			[],
		];

		const result = await createPostAction({
			groupId: TEST_GROUP_ID,
			content: "Check out this rare pressing!",
		});

		expect(result).toEqual({ id: "post-1" });
	});

	test("creates post with linked release_id", async () => {
		queryResults = [
			[{ id: "member-1" }],
			[{ name: "Jazz Group", slug: "jazz-group" }],
			[{ id: "post-2" }],
			[],
		];

		const result = await createPostAction({
			groupId: TEST_GROUP_ID,
			content: "My latest find",
			releaseId: TEST_RELEASE_ID,
		});

		expect(result).toEqual({ id: "post-2" });
		expect(mockInsertValues).toHaveBeenCalled();
	});

	test("rejects empty content", async () => {
		await expect(
			createPostAction({
				groupId: TEST_GROUP_ID,
				content: "",
			}),
		).rejects.toThrow("Post content is required");
	});

	test("requires group membership (rejects non-member)", async () => {
		queryResults = [
			// No membership found
			[],
		];

		await expect(
			createPostAction({
				groupId: TEST_GROUP_ID,
				content: "I want to post here",
			}),
		).rejects.toThrow("You must be a member of this group to post.");
	});

	test("calls logActivity with actionType group_post", async () => {
		queryResults = [
			[{ id: "member-1" }],
			[{ name: "Jazz Group", slug: "jazz-group" }],
			[{ id: "post-1" }],
			[],
		];

		await createPostAction({
			groupId: TEST_GROUP_ID,
			content: "New post content",
		});

		expect(logActivity).toHaveBeenCalledWith(
			"test-user-id",
			"group_post",
			"group_post",
			"post-1",
			expect.objectContaining({
				groupId: TEST_GROUP_ID,
				groupName: "Jazz Group",
				groupSlug: "jazz-group",
			}),
		);
	});
});
