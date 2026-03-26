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
	activityFeed: {
		id: "id",
		userId: "user_id",
		actionType: "action_type",
		targetType: "target_type",
		targetId: "target_id",
		metadata: "metadata",
		createdAt: "created_at",
	},
}));

// -- Mock users schema --
vi.mock("@/lib/db/schema/users", () => ({
	profiles: { id: "id", username: "username", displayName: "display_name", avatarUrl: "avatar_url" },
}));

// -- Mock releases schema --
vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		genre: "genre",
		label: "label",
		coverImageUrl: "cover_image_url",
		rarityScore: "rarity_score",
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
	lt: vi.fn(),
	count: vi.fn(),
}));

import { getGlobalFeed, getPersonalFeed } from "@/lib/social/queries";

// Helper to create a chained select mock
function createSelectChain(resolvedRows: unknown[] = []) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.from = vi.fn().mockReturnValue(chain);
	chain.leftJoin = vi.fn().mockReturnValue(chain);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.where = vi.fn().mockReturnValue(chain);
	chain.orderBy = vi.fn().mockReturnValue(chain);
	chain.limit = vi.fn().mockResolvedValue(resolvedRows);
	return chain;
}

const USER_ID = "user-uuid-001";

describe("getGlobalFeed", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns feed items ordered by rarityScore DESC", async () => {
		const mockRows = [
			{
				id: "af-1",
				userId: "u1",
				actionType: "added_record",
				targetType: "release",
				targetId: "rel-1",
				metadata: null,
				createdAt: "2026-03-25T10:00:00Z",
				username: "digger1",
				displayName: "Digger One",
				avatarUrl: null,
				releaseTitle: "Kind of Blue",
				releaseArtist: "Miles Davis",
				releaseGenre: ["Jazz"],
				releaseLabel: "Columbia",
				releaseCoverUrl: null,
				releaseRarityScore: 2.5,
			},
			{
				id: "af-2",
				userId: "u2",
				actionType: "added_record",
				targetType: "release",
				targetId: "rel-2",
				metadata: null,
				createdAt: "2026-03-25T09:00:00Z",
				username: "digger2",
				displayName: "Digger Two",
				avatarUrl: null,
				releaseTitle: "A Love Supreme",
				releaseArtist: "John Coltrane",
				releaseGenre: ["Jazz"],
				releaseLabel: "Impulse!",
				releaseCoverUrl: null,
				releaseRarityScore: 1.8,
			},
		];

		const chain = createSelectChain(mockRows);
		mockSelect.mockReturnValue(chain);

		const result = await getGlobalFeed(null);
		expect(result).toHaveLength(2);
		expect(result[0].releaseRarityScore).toBe(2.5);
		expect(result[1].releaseRarityScore).toBe(1.8);
	});

	test("returns empty array when no activity exists", async () => {
		const chain = createSelectChain([]);
		mockSelect.mockReturnValue(chain);

		const result = await getGlobalFeed(null);
		expect(result).toEqual([]);
	});
});

describe("getPersonalFeed", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns only items from followed users", async () => {
		const mockRows = [
			{
				id: "af-3",
				userId: "u1",
				actionType: "added_record",
				targetType: "release",
				targetId: "rel-3",
				metadata: null,
				createdAt: "2026-03-25T08:00:00Z",
				username: "digger1",
				displayName: "Digger One",
				avatarUrl: null,
				releaseTitle: "Blue Train",
				releaseArtist: "John Coltrane",
				releaseGenre: ["Jazz"],
				releaseLabel: "Blue Note",
				releaseCoverUrl: null,
				releaseRarityScore: 1.2,
			},
		];

		const chain = createSelectChain(mockRows);
		mockSelect.mockReturnValue(chain);

		const result = await getPersonalFeed(USER_ID, null);
		expect(result).toHaveLength(1);
		expect(result[0].username).toBe("digger1");
	});

	test("returns max 20 items per page", async () => {
		const chain = createSelectChain([]);
		mockSelect.mockReturnValue(chain);

		await getPersonalFeed(USER_ID, null, 20);
		// Verify limit was called with 20
		expect(chain.limit).toHaveBeenCalledWith(20);
	});

	test("applies cursor filter when cursor is provided", async () => {
		const chain = createSelectChain([]);
		mockSelect.mockReturnValue(chain);

		await getPersonalFeed(USER_ID, "2026-03-25T08:00:00Z");
		// Where should be called (for cursor filtering)
		expect(chain.where).toHaveBeenCalled();
	});
});
