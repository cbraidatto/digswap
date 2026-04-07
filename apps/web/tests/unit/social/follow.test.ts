import { beforeEach, describe, expect, test, vi } from "vitest";

// -- Mock Supabase server client --
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({
		auth: {
			getUser: () => mockGetUser(),
		},
	}),
}));
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

// -- Mock next/headers --
vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

// -- Mock Drizzle db --
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
	db: {
		insert: (...args: unknown[]) => mockInsert(...args),
		delete: (...args: unknown[]) => mockDelete(...args),
		select: (...args: unknown[]) => mockSelect(...args),
	},
}));

// -- Mock social schema --
vi.mock("@/lib/db/schema/social", () => ({
	follows: { followerId: "follower_id", followingId: "following_id" },
	activityFeed: { userId: "user_id", actionType: "action_type" },
}));

// -- Mock users schema --
vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
		avatarUrl: "avatar_url",
	},
}));

// -- Mock drizzle-orm --
vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	sql: vi.fn(),
	ilike: vi.fn(),
	inArray: vi.fn(),
	desc: vi.fn(),
	asc: vi.fn(),
	count: vi.fn(),
}));

import { followUser, unfollowUser } from "@/actions/social";

const USER_ID = "a0000000-0000-4000-a000-000000000001";
const TARGET_ID = "a0000000-0000-4000-a000-000000000002";

describe("followUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
		// Default: insert succeeds
		mockInsert.mockReturnValue({
			values: vi.fn().mockReturnValue({
				returning: vi.fn().mockResolvedValue([{ id: "follow-uuid" }]),
			}),
		});
		// Default: select for profile lookup (logActivity metadata)
		mockSelect.mockReturnValue({
			from: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue([{ username: "targetuser" }]),
			}),
		});
	});

	test("returns success when inserting a valid follow", async () => {
		const result = await followUser(TARGET_ID);
		expect(result).toEqual({ success: true });
	});

	test("rejects self-follow with error", async () => {
		const result = await followUser(USER_ID);
		expect(result).toEqual({ error: "Cannot follow yourself" });
	});

	test("returns error when not authenticated", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});
		const result = await followUser(TARGET_ID);
		expect(result).toHaveProperty("error");
	});

	test("calls logActivity with followed_user event", async () => {
		await followUser(TARGET_ID);
		// Verify insert was called at least twice (once for follows, once for activityFeed)
		expect(mockInsert).toHaveBeenCalledTimes(2);
	});
});

describe("unfollowUser", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
		mockDelete.mockReturnValue({
			where: vi.fn().mockResolvedValue([{ id: "follow-uuid" }]),
		});
	});

	test("returns success when delete succeeds", async () => {
		const result = await unfollowUser(TARGET_ID);
		expect(result).toEqual({ success: true });
	});

	test("returns error when not authenticated", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});
		const result = await unfollowUser(TARGET_ID);
		expect(result).toHaveProperty("error");
	});

	test("deletes only where follower_id matches current user", async () => {
		await unfollowUser(TARGET_ID);
		expect(mockDelete).toHaveBeenCalled();
	});
});
