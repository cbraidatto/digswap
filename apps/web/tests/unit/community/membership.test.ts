import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();

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
		where: mockDeleteWhere.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				const result = queryResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	// Transaction: executes callback with the same chain (test isolation)
	chain.transaction = vi.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
		return cb(chain);
	});

	return { db: chain };
})
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));
;

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
import { joinGroupAction, leaveGroupAction } from "@/actions/community";

describe("joinGroupAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("inserts membership row on join", async () => {
		queryResults = [
			// Query 0: check group exists
			[{ id: "group-1", name: "Jazz Group", slug: "jazz-group", visibility: "public" }],
			// Query 1: check not already member
			[],
			// Query 2: insert member
			[{ id: "member-1" }],
			// Query 3: update member_count
			[],
			// Query 4: logActivity
			[],
		];

		const result = await joinGroupAction("group-1");

		expect(result).toEqual({ success: true });
		expect(mockInsertValues).toHaveBeenCalled();
	});

	test("increments member_count on join", async () => {
		queryResults = [
			[{ id: "group-1", name: "Jazz Group", slug: "jazz-group", visibility: "public" }],
			[], // not already member
			[{ id: "member-1" }], // insert member
			[], // update member_count
			[], // logActivity
		];

		await joinGroupAction("group-1");

		expect(mockUpdateSet).toHaveBeenCalled();
	});

	test("returns error when already member", async () => {
		queryResults = [
			[{ id: "group-1", name: "Jazz Group", slug: "jazz-group", visibility: "public" }],
			[{ id: "existing-member" }], // already a member
		];

		const result = await joinGroupAction("group-1");

		expect(result).toEqual({ error: "Already a member of this group." });
	});
});

describe("leaveGroupAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("deletes membership row on leave", async () => {
		queryResults = [
			// Query 0: check membership (member, not admin)
			[{ id: "member-1", role: "member" }],
			// Query 1: delete member
			[],
			// Query 2: decrement member_count
			[],
		];

		const result = await leaveGroupAction("group-1");

		expect(result).toEqual({ success: true });
		expect(mockDeleteWhere).toHaveBeenCalled();
	});

	test("decrements member_count on leave", async () => {
		queryResults = [
			[{ id: "member-1", role: "member" }],
			[], // delete member
			[], // decrement member_count
		];

		await leaveGroupAction("group-1");

		expect(mockUpdateSet).toHaveBeenCalled();
	});

	test("returns error when not a member", async () => {
		queryResults = [
			// No membership found
			[],
		];

		const result = await leaveGroupAction("group-1");

		expect(result).toEqual({ error: "Not a member of this group." });
	});

	test("prevents sole admin from leaving", async () => {
		queryResults = [
			// Query 0: membership check (admin)
			[{ id: "member-1", role: "admin" }],
			// Query 1: other admins check (only self = 1 admin)
			[{ id: "member-1" }],
		];

		const result = await leaveGroupAction("group-1");

		expect(result).toEqual({
			error: "Cannot leave as the sole admin. Promote another member first.",
		});
	});
});
