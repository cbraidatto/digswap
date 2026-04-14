import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const USER_ID = "user-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select", "selectDistinctOn", "from", "where", "orderBy",
		"limit", "offset", "innerJoin", "leftJoin",
	];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});

vi.mock("@/lib/db/schema/social", () => ({
	activityFeed: {
		id: "id",
		userId: "user_id",
		actionType: "action_type",
		targetType: "target_type",
		targetId: "target_id",
		metadata: "metadata",
		createdAt: "created_at",
	},
	follows: {
		id: "id",
		followerId: "follower_id",
		followingId: "following_id",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
		avatarUrl: "avatar_url",
		discogsConnected: "discogs_connected",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		genre: "genre",
		label: "label",
		coverImageUrl: "cover_image_url",
		rarityScore: "rarity_score",
		youtubeVideoId: "youtube_video_id",
		style: "style",
	},
}));

vi.mock("@/lib/db/schema/groups", () => ({
	groupMembers: {
		groupId: "group_id",
		userId: "user_id",
	},
}));

const { getGlobalFeed, getPersonalFeed, getFollowCounts, getFollowers, getFollowing, checkIsFollowing } =
	await import("@/lib/social/queries");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function feedRow(overrides?: Record<string, unknown>) {
	return {
		id: "feed-1",
		userId: USER_ID,
		actionType: "collection_add",
		targetType: "release",
		targetId: "rel-1",
		metadata: null,
		createdAt: new Date("2024-06-01T00:00:00Z"),
		username: "digger42",
		displayName: "The Digger",
		avatarUrl: null,
		releaseTitle: "Kind of Blue",
		releaseArtist: "Miles Davis",
		releaseGenre: ["Jazz"],
		releaseLabel: "Columbia",
		releaseCoverUrl: null,
		releaseRarityScore: 85,
		releaseYoutubeVideoId: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("getGlobalFeed", () => {
	it("returns feed items with ISO date strings", async () => {
		selectResults = [[feedRow()]];

		const result = await getGlobalFeed(null);
		expect(result).toHaveLength(1);
		expect(result[0].createdAt).toBe("2024-06-01T00:00:00.000Z");
		expect(result[0].actionType).toBe("collection_add");
	});

	it("returns empty array when no activity", async () => {
		selectResults = [[]];

		const result = await getGlobalFeed(null);
		expect(result).toEqual([]);
	});

	it("handles string createdAt values", async () => {
		selectResults = [[feedRow({ createdAt: "2024-06-15T10:00:00Z" })]];

		const result = await getGlobalFeed(null);
		expect(result[0].createdAt).toBe("2024-06-15T10:00:00Z");
	});

	it("passes metadata through as-is", async () => {
		const meta = { genre: "Jazz", source: "discogs" };
		selectResults = [[feedRow({ metadata: meta })]];

		const result = await getGlobalFeed(null);
		expect(result[0].metadata).toEqual(meta);
	});

	it("respects cursor for pagination", async () => {
		selectResults = [[feedRow()]];

		const result = await getGlobalFeed("2024-06-01T00:00:00Z");
		expect(result).toHaveLength(1);
	});
});

describe("getPersonalFeed", () => {
	it("returns feed items for followed users", async () => {
		selectResults = [[feedRow({ userId: "other-user" })]];

		const result = await getPersonalFeed(USER_ID, null);
		expect(result).toHaveLength(1);
	});

	it("returns empty when no followed activity", async () => {
		selectResults = [[]];

		const result = await getPersonalFeed(USER_ID, null);
		expect(result).toEqual([]);
	});
});

describe("getFollowCounts", () => {
	it("returns both following and follower counts", async () => {
		selectResults = [
			[{ count: 15 }],
			[{ count: 42 }],
		];

		const result = await getFollowCounts(USER_ID);
		expect(result.followingCount).toBe(15);
		expect(result.followerCount).toBe(42);
	});

	it("returns 0 when no follows", async () => {
		selectResults = [
			[{ count: 0 }],
			[{ count: 0 }],
		];

		const result = await getFollowCounts(USER_ID);
		expect(result.followingCount).toBe(0);
		expect(result.followerCount).toBe(0);
	});

	it("handles missing count row gracefully", async () => {
		selectResults = [[], []];

		const result = await getFollowCounts(USER_ID);
		expect(result.followingCount).toBe(0);
		expect(result.followerCount).toBe(0);
	});
});

describe("getFollowers", () => {
	it("returns follower profiles", async () => {
		selectResults = [[
			{ id: "u-1", username: "crate_digger", displayName: "Crate Digger", avatarUrl: null },
		]];

		const result = await getFollowers(USER_ID);
		expect(result).toHaveLength(1);
		expect(result[0].username).toBe("crate_digger");
	});

	it("returns empty array when no followers", async () => {
		selectResults = [[]];

		const result = await getFollowers(USER_ID);
		expect(result).toEqual([]);
	});
});

describe("getFollowing", () => {
	it("returns following profiles", async () => {
		selectResults = [[
			{ id: "u-2", username: "vinyl_hunter", displayName: "Vinyl Hunter", avatarUrl: null },
		]];

		const result = await getFollowing(USER_ID);
		expect(result).toHaveLength(1);
		expect(result[0].username).toBe("vinyl_hunter");
	});
});

describe("checkIsFollowing", () => {
	it("returns true when follow relationship exists", async () => {
		selectResults = [[{ id: "follow-1" }]];

		const result = await checkIsFollowing(USER_ID, "target-user");
		expect(result).toBe(true);
	});

	it("returns false when no follow relationship", async () => {
		selectResults = [[]];

		const result = await checkIsFollowing(USER_ID, "target-user");
		expect(result).toBe(false);
	});
});
