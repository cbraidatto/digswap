import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_A };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
let mockRateLimitSuccess = true;

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: mockRateLimitSuccess })),
}));

vi.mock("@/lib/social/log-activity", () => ({
	logActivity: vi.fn(async () => {}),
}));

vi.mock("@/lib/social/queries", () => ({
	getFollowers: vi.fn(async () => []),
	getFollowing: vi.fn(async () => []),
	getGlobalFeed: vi.fn(async () => []),
	getPersonalFeed: vi.fn(async () => []),
}));

vi.mock("@/lib/social/explore-queries", () => ({
	getExploreFeed: vi.fn(async () => []),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.delete = vi.fn().mockImplementation(() => ({
		where: vi.fn().mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/social", () => ({
	follows: {
		followerId: "follower_id",
		followingId: "following_id",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
		avatarUrl: "avatar_url",
	},
}));

const {
	followUser,
	unfollowUser,
	searchUsers,
	loadMoreFeed,
	loadExploreFeed,
	fetchFollowersList,
	fetchFollowingList,
} = await import("@/actions/social");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_A };
	selectResults = [];
	queryCallCount = 0;
	mockRateLimitSuccess = true;
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("followUser", () => {
	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await followUser(USER_B);
		expect(result.error).toBe("Not authenticated");
	});

	it("prevents self-follow", async () => {
		const result = await followUser(USER_A);
		expect(result.error).toBe("Cannot follow yourself");
	});

	it("rejects invalid user ID", async () => {
		const result = await followUser("not-a-uuid");
		expect(result.error).toBe("Invalid user ID");
	});

	it("follows another user successfully", async () => {
		// First select: target profile lookup for logActivity
		selectResults = [[{ username: "vinyl_digger" }]];
		const result = await followUser(USER_B);
		expect(result.success).toBe(true);
	});

	it("returns error when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await followUser(USER_B);
		expect(result.error).toContain("Too many requests");
	});
});

describe("unfollowUser", () => {
	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await unfollowUser(USER_B);
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid user ID", async () => {
		const result = await unfollowUser("bad-id");
		expect(result.error).toBe("Invalid user ID");
	});

	it("unfollows a user successfully", async () => {
		const result = await unfollowUser(USER_B);
		expect(result.success).toBe(true);
	});

	it("returns error when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await unfollowUser(USER_B);
		expect(result.error).toContain("Too many requests");
	});
});

describe("searchUsers", () => {
	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await searchUsers("test");
		expect(result).toEqual([]);
	});

	it("returns empty for too-short query (validation)", async () => {
		const result = await searchUsers("a");
		expect(result).toEqual([]);
	});

	it("returns empty when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await searchUsers("vinyl");
		expect(result).toEqual([]);
	});

	it("returns matching profiles", async () => {
		selectResults = [
			[
				{
					id: USER_B,
					username: "vinyl_collector",
					displayName: "Vinyl Collector",
					avatarUrl: null,
					recordCount: 42,
					followerCount: 10,
					isFollowing: false,
				},
			],
		];
		const result = await searchUsers("vinyl");
		expect(result).toHaveLength(1);
		expect(result[0].username).toBe("vinyl_collector");
		expect(result[0].recordCount).toBe(42);
	});
});

describe("loadMoreFeed", () => {
	it("returns empty when unauthenticated", async () => {
		mockAuthUser = null;
		const result = await loadMoreFeed(null, "personal");
		expect(result).toEqual([]);
	});

	it("routes personal mode to getPersonalFeed", async () => {
		const { getPersonalFeed } = await import("@/lib/social/queries");
		await loadMoreFeed(null, "personal");
		expect(getPersonalFeed).toHaveBeenCalledWith(USER_A, null);
	});

	it("routes global mode to getGlobalFeed", async () => {
		const { getGlobalFeed } = await import("@/lib/social/queries");
		await loadMoreFeed(null, "global");
		expect(getGlobalFeed).toHaveBeenCalledWith(null);
	});

	it("routes explore mode to getExploreFeed", async () => {
		const { getExploreFeed } = await import("@/lib/social/explore-queries");
		await loadMoreFeed(null, "explore");
		expect(getExploreFeed).toHaveBeenCalledWith(USER_A, null);
	});

	it("returns empty on invalid mode", async () => {
		// biome-ignore lint: testing invalid input deliberately
		const result = await loadMoreFeed(null, "invalid" as any);
		expect(result).toEqual([]);
	});
});

describe("loadExploreFeed", () => {
	it("returns empty when unauthenticated", async () => {
		mockAuthUser = null;
		const result = await loadExploreFeed(null);
		expect(result).toEqual([]);
	});

	it("calls getExploreFeed with user and cursor", async () => {
		const { getExploreFeed } = await import("@/lib/social/explore-queries");
		await loadExploreFeed("some-cursor");
		expect(getExploreFeed).toHaveBeenCalledWith(USER_A, "some-cursor");
	});
});

describe("fetchFollowersList", () => {
	it("returns empty when unauthenticated", async () => {
		mockAuthUser = null;
		const result = await fetchFollowersList(USER_B);
		expect(result).toEqual([]);
	});

	it("rejects invalid user ID", async () => {
		const result = await fetchFollowersList("bad");
		expect(result).toEqual([]);
	});

	it("returns followers for valid user", async () => {
		const { getFollowers } = await import("@/lib/social/queries");
		await fetchFollowersList(USER_B);
		expect(getFollowers).toHaveBeenCalledWith(USER_B);
	});
});

describe("fetchFollowingList", () => {
	it("returns empty when unauthenticated", async () => {
		mockAuthUser = null;
		const result = await fetchFollowingList(USER_B);
		expect(result).toEqual([]);
	});

	it("rejects invalid user ID", async () => {
		const result = await fetchFollowingList("bad");
		expect(result).toEqual([]);
	});

	it("returns following for valid user", async () => {
		const { getFollowing } = await import("@/lib/social/queries");
		await fetchFollowingList(USER_B);
		expect(getFollowing).toHaveBeenCalledWith(USER_B);
	});
});
