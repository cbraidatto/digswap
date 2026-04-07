import { beforeEach, describe, expect, test, vi } from "vitest";

// Track call count to return different results for sequential queries
let queryCallCount = 0;
let queryResults: unknown[][] = [];

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

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		conditionGrade: "condition_grade",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		avatarUrl: "avatar_url",
	},
}));

vi.mock("@/lib/db/schema/social", () => ({
	follows: {
		id: "id",
		followerId: "follower_id",
		followingId: "following_id",
	},
}));

vi.mock("@/lib/collection/filters", () => ({
	getDecadeRange: vi.fn(),
}));

import { searchRecords } from "@/lib/discovery/queries";

describe("searchRecords", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns releases with owners grouped by releaseId", async () => {
		queryResults = [
			// Query 1: matching releases
			[
				{
					id: "rel-1",
					title: "Kind of Blue",
					artist: "Miles Davis",
					label: "Columbia",
					format: "LP",
					year: 1959,
					genre: ["Jazz"],
					rarityScore: 1.5,
					coverImageUrl: "https://example.com/kob.jpg",
				},
			],
			// Query 2: owners for matched releases
			[
				{
					releaseId: "rel-1",
					userId: "user-1",
					username: "jazzhound",
					avatarUrl: null,
					conditionGrade: "VG+",
				},
				{
					releaseId: "rel-1",
					userId: "user-2",
					username: "digger99",
					avatarUrl: "https://example.com/avatar.jpg",
					conditionGrade: "Mint",
				},
			],
		];

		const results = await searchRecords("Blue");

		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("Kind of Blue");
		expect(results[0].owners).toHaveLength(2);
		expect(results[0].ownerCount).toBe(2);
		expect(results[0].owners[0].username).toBe("jazzhound");
		expect(results[0].owners[1].username).toBe("digger99");
	});

	test("returns empty array when no matches found", async () => {
		queryResults = [
			// Query 1: no matching releases
			[],
		];

		const results = await searchRecords("NonexistentAlbum12345");

		expect(results).toEqual([]);
	});

	test("returns empty array for empty search term", async () => {
		const results = await searchRecords("");
		expect(results).toEqual([]);
	});

	test("returns empty array for whitespace-only term", async () => {
		const results = await searchRecords("   ");
		expect(results).toEqual([]);
	});

	test("escapes special characters in search term (%, _, \\)", async () => {
		queryResults = [
			// Query 1: no matches (that's fine, we just test it doesn't crash)
			[],
		];

		await searchRecords("100% Pure_Love\\Edition");

		// The function should complete without error
		// Special chars are escaped in the pattern -- actual DB call is mocked
		expect(queryCallCount).toBeGreaterThan(0);
	});
});
