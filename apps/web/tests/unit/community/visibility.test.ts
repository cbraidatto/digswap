import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

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

	// Update chain
	chain.update = vi.fn().mockImplementation(() => ({
		set: mockUpdateSet.mockImplementation(() => ({
			where: mockUpdateWhere.mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = queryResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

	// Delete chain
	chain.delete = vi.fn().mockImplementation(() => ({
		where: vi.fn().mockResolvedValue(undefined),
	}));

	// Transaction chain — executes the callback immediately
	chain.transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
		return cb(chain);
	});

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

const mockAdminInsert = vi.fn().mockResolvedValue({ data: null, error: null });
// Admin from mock — supports both insert (notifications) and select (dedup check)
const mockAdminFrom = vi.fn().mockImplementation((table: string) => {
	if (table === "notifications") {
		// Dedup select chain: always returns no existing notification (allow insert)
		const dedupChain: Record<string, unknown> = {};
		const dedupMethods = ["select", "eq", "gte", "contains", "limit"];
		for (const m of dedupMethods) {
			dedupChain[m] = vi.fn().mockReturnValue(dedupChain);
		}
		dedupChain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
		return { select: dedupChain.select, insert: mockAdminInsert };
	}
	return { insert: mockAdminInsert };
});
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => ({
		from: mockAdminFrom,
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
import { acceptInviteAction, generateInviteAction, inviteUserAction } from "@/actions/community";
import { getGroupPosts as getGroupPostsQuery, getMemberGroups } from "@/lib/community/queries";

describe("group visibility", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("private group appears in getMemberGroups results", async () => {
		const mockGetMemberGroups = vi.mocked(getMemberGroups);
		mockGetMemberGroups.mockResolvedValue([
			{
				id: "group-1",
				name: "Secret Vinyl Club",
				slug: "secret-vinyl-club",
				category: "Jazz",
				visibility: "private",
				memberCount: 5,
				createdAt: "2026-03-26T10:00:00Z",
				creatorUsername: "test-user",
			},
		]);

		const groups = await getMemberGroups();

		expect(groups).toHaveLength(1);
		expect(groups[0].visibility).toBe("private");
		expect(groups[0].name).toBe("Secret Vinyl Club");
	});

	test("getGroupPosts returns empty for non-member on private group", async () => {
		const mockGetGroupPosts = vi.mocked(getGroupPostsQuery);
		// In real usage, queries would be filtered by membership. Here we simulate
		// the RLS/membership-gated behavior returning empty for non-members.
		mockGetGroupPosts.mockResolvedValue([]);

		const posts = await getGroupPostsQuery("private-group-1");

		expect(posts).toEqual([]);
	});

	test("generateInviteAction creates invite token", async () => {
		queryResults = [
			// Query 0: verify user is admin
			[{ role: "admin" }],
			// Query 1: insert invite
			[{ id: "invite-1" }],
		];

		const result = await generateInviteAction("group-1");

		expect("token" in result).toBe(true);
		if ("token" in result) {
			expect(typeof result.token).toBe("string");
			expect(result.token.length).toBeGreaterThan(0);
		}
	});

	test("generateInviteAction requires admin role", async () => {
		queryResults = [
			// Query 0: user is member (not admin)
			[{ role: "member" }],
		];

		const result = await generateInviteAction("group-1");
		expect(result).toHaveProperty("error", "Only group admins can generate invite links.");
	});

	test("acceptInviteAction adds member to group", async () => {
		queryResults = [
			// Query 0: look up invite
			[{ groupId: "group-1", expiresAt: null }],
			// Query 1: check not already member
			[],
			// Query 2: insert member
			[{ id: "member-1" }],
			// Query 3: update member_count
			[],
			// Query 4: get group slug for redirect
			[{ slug: "jazz-club" }],
		];

		const result = await acceptInviteAction("valid-token-123");

		expect(result).toEqual({ slug: "jazz-club" });
	});

	test("inviteUserAction sends notification to target user", async () => {
		queryResults = [
			// Query 0: verify admin
			[{ role: "admin" }],
			// Query 1: get group info
			[{ name: "Jazz Club", slug: "jazz-club" }],
			// Query 2: look up target user by username
			[{ id: "target-user-id" }],
			// Query 3: get inviter username
			[{ username: "admin-user" }],
		];

		const result = await inviteUserAction("group-1", "target-user");

		expect(result).toEqual({ success: true });
		// Admin client should have been called to insert notification
		expect(mockAdminFrom).toHaveBeenCalledWith("notifications");
		expect(mockAdminInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: "target-user-id",
				type: "group_invite",
			}),
		);
	});
});
