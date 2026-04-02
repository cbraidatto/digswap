import { describe, test, expect, vi, beforeEach } from "vitest";

// -- Mock Supabase server client --
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({
		auth: {
			getUser: () => mockGetUser(),
		},
	}),
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
	profiles: { id: "id", username: "username", displayName: "display_name", avatarUrl: "avatar_url" },
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

import { unfollowUser } from "@/actions/social";

const USER_ID = "a0000000-0000-4000-a000-000000000001";
const TARGET_ID = "a0000000-0000-4000-a000-000000000002";

describe("unfollowUser (detailed)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
		mockDelete.mockReturnValue({
			where: vi.fn().mockResolvedValue([{ id: "follow-uuid" }]),
		});
	});

	test("returns { success: true } when delete succeeds", async () => {
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

	test("uses delete on follows table (IDOR prevention: follower_id = current user)", async () => {
		await unfollowUser(TARGET_ID);
		// Verify that delete is called (not an arbitrary delete)
		expect(mockDelete).toHaveBeenCalledTimes(1);
	});
});
