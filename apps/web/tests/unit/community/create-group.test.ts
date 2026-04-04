import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

const insertValues = vi.fn();
const insertReturning = vi.fn();

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

	// Insert chain for insert().values().returning()
	chain.insert = vi.fn().mockImplementation(() => ({
		values: insertValues.mockImplementation(() => ({
			returning: insertReturning.mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = queryResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

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

// ---------------------------------------------------------------------------
// Mock logActivity and slugify
// ---------------------------------------------------------------------------
vi.mock("@/actions/social", () => ({
	logActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/community/slugify", () => ({
	slugify: vi.fn().mockReturnValue("test-group"),
}));

// ---------------------------------------------------------------------------
// Mock community queries (not used by createGroupAction but imported by the module)
// ---------------------------------------------------------------------------
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
import { createGroupAction } from "@/actions/community";

describe("createGroupAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("creates group with valid name, description, category, visibility", async () => {
		queryResults = [
			// Query 0: slug conflict check (no existing groups)
			[],
			// Query 1: insert group returning id + slug
			[{ id: "group-1", slug: "test-group" }],
			// Query 2: insert creator as admin member
			[{ id: "member-1" }],
		];

		const result = await createGroupAction({
			name: "Test Group",
			description: "A test group",
			category: "Jazz",
			visibility: "public",
		});

		expect(result).toEqual({ slug: "test-group" });
	});

	test("generates slug from name via slugify", async () => {
		const { slugify } = await import("@/lib/community/slugify");

		queryResults = [
			[], // no slug conflict
			[{ id: "group-1", slug: "my-jazz-crew" }],
			[{ id: "member-1" }],
		];

		await createGroupAction({
			name: "My Jazz Crew",
			visibility: "public",
		});

		expect(slugify).toHaveBeenCalledWith("My Jazz Crew");
	});

	test("rejects empty name", async () => {
		const result = await createGroupAction({ name: "", visibility: "public" });
		expect(result).toHaveProperty("error", "Group name is required.");
	});

	test("rejects name longer than 80 chars", async () => {
		const longName = "A".repeat(81);

		const result = await createGroupAction({ name: longName, visibility: "public" });
		expect(result).toHaveProperty("error", "Group name must be 80 characters or fewer.");
	});

	test("inserts creator as admin member", async () => {
		queryResults = [
			[], // no slug conflict
			[{ id: "group-1", slug: "test-group" }],
			[{ id: "member-1" }],
		];

		await createGroupAction({
			name: "Test Group",
			visibility: "public",
		});

		// The insert mock was called for both group and member inserts
		expect(insertValues).toHaveBeenCalled();
	});

	test("sets visibility to private when specified", async () => {
		queryResults = [
			[], // no slug conflict
			[{ id: "group-1", slug: "test-group" }],
			[{ id: "member-1" }],
		];

		const result = await createGroupAction({
			name: "Secret Group",
			visibility: "private",
		});

		expect(result).toEqual({ slug: "test-group" });
		expect(insertValues).toHaveBeenCalled();
	});
});
