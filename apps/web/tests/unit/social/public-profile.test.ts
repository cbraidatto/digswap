import { describe, test, expect, vi, beforeEach } from "vitest";

// -- Mock Drizzle db --
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

// -- Mock social schema --
vi.mock("@/lib/db/schema/social", () => ({
	follows: { followerId: "follower_id", followingId: "following_id" },
	activityFeed: { userId: "user_id" },
}));

// -- Mock users schema --
vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
		avatarUrl: "avatar_url",
		discogsConnected: "discogs_connected",
	},
}));

// -- Mock drizzle-orm --
vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	sql: vi.fn(() => "sql-fragment"),
	ilike: vi.fn(),
	inArray: vi.fn(),
	desc: vi.fn(),
	asc: vi.fn(),
	count: vi.fn(() => "count-fragment"),
}));

import {
	getFollowCounts,
	checkIsFollowing,
	getFollowers,
	getFollowing,
} from "@/lib/social/queries";

const USER_ID = "user-uuid-001";
const TARGET_ID = "user-uuid-002";

// Helper to create a chained select mock
function createSelectChain(resolvedRows: unknown[] = []) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.from = vi.fn().mockReturnValue(chain);
	chain.leftJoin = vi.fn().mockReturnValue(chain);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.where = vi.fn().mockReturnValue(chain);
	chain.orderBy = vi.fn().mockReturnValue(chain);
	chain.limit = vi.fn().mockReturnValue(chain);
	chain.offset = vi.fn().mockResolvedValue(resolvedRows);
	// Also make chain itself thenable for queries that end at .where()
	chain.then = vi.fn().mockImplementation((resolve: (v: unknown) => void) => resolve(resolvedRows));
	return chain;
}

describe("getFollowCounts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns { followingCount, followerCount } numbers", async () => {
		// First call: following count, second call: follower count
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount === 1) {
				return createSelectChain([{ count: 5 }]);
			}
			return createSelectChain([{ count: 12 }]);
		});

		const result = await getFollowCounts(USER_ID);

		expect(result).toHaveProperty("followingCount");
		expect(result).toHaveProperty("followerCount");
		expect(typeof result.followingCount).toBe("number");
		expect(typeof result.followerCount).toBe("number");
	});
});

describe("checkIsFollowing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns true when follow row exists", async () => {
		const chain = createSelectChain([{ id: "follow-1" }]);
		mockSelect.mockReturnValue(chain);

		const result = await checkIsFollowing(USER_ID, TARGET_ID);
		expect(result).toBe(true);
	});

	test("returns false when no follow row exists", async () => {
		const chain = createSelectChain([]);
		mockSelect.mockReturnValue(chain);

		const result = await checkIsFollowing(USER_ID, TARGET_ID);
		expect(result).toBe(false);
	});
});

describe("getFollowers", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns array of { id, username, displayName, avatarUrl }", async () => {
		const mockFollowers = [
			{ id: "u1", username: "digger1", displayName: "Digger One", avatarUrl: null },
			{ id: "u2", username: "digger2", displayName: "Digger Two", avatarUrl: "https://example.com/avatar.jpg" },
		];
		const chain = createSelectChain(mockFollowers);
		mockSelect.mockReturnValue(chain);

		const result = await getFollowers(USER_ID);

		expect(result).toHaveLength(2);
		expect(result[0]).toHaveProperty("id");
		expect(result[0]).toHaveProperty("username");
		expect(result[0]).toHaveProperty("displayName");
		expect(result[0]).toHaveProperty("avatarUrl");
	});
});

describe("getFollowing", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns array of same shape as getFollowers", async () => {
		const mockFollowing = [
			{ id: "u3", username: "digger3", displayName: "Digger Three", avatarUrl: null },
		];
		const chain = createSelectChain(mockFollowing);
		mockSelect.mockReturnValue(chain);

		const result = await getFollowing(USER_ID);

		expect(result).toHaveLength(1);
		expect(result[0]).toHaveProperty("id");
		expect(result[0]).toHaveProperty("username");
	});
});
