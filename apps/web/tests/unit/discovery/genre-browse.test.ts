import { describe, test, expect, vi, beforeEach } from "vitest";

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
	getDecadeRange: vi.fn((decade: string) => {
		const map: Record<string, { start: number; end: number }> = {
			"80s": { start: 1980, end: 1990 },
			"70s": { start: 1970, end: 1980 },
			"90s": { start: 1990, end: 2000 },
		};
		return map[decade] ?? null;
	}),
}));

import { browseRecords } from "@/lib/discovery/queries";
import { db } from "@/lib/db";

describe("browseRecords", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
		// Re-setup the chain returns after clearAllMocks
		for (const method of [
			"select",
			"from",
			"where",
			"orderBy",
			"limit",
			"innerJoin",
			"leftJoin",
			"groupBy",
			"offset",
		]) {
			vi.mocked(
				(db as Record<string, unknown>)[method] as () => unknown,
			).mockImplementation(() => db);
		}
	});

	test("returns filtered results when genre is provided", async () => {
		queryResults = [
			[
				{
					id: "rel-1",
					title: "A Love Supreme",
					artist: "John Coltrane",
					label: "Impulse!",
					format: "LP",
					year: 1965,
					genre: ["Jazz"],
					rarityScore: 2.1,
					coverImageUrl: null,
					ownerCount: 3,
				},
			],
		];

		const results = await browseRecords("Jazz", null);

		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("A Love Supreme");
		expect(results[0].ownerCount).toBe(3);
	});

	test("returns filtered results when decade is provided", async () => {
		queryResults = [
			[
				{
					id: "rel-2",
					title: "Thriller",
					artist: "Michael Jackson",
					label: "Epic",
					format: "LP",
					year: 1982,
					genre: ["Pop"],
					rarityScore: 0.3,
					coverImageUrl: null,
					ownerCount: 10,
				},
			],
		];

		const results = await browseRecords(null, "80s");

		expect(results).toHaveLength(1);
		expect(results[0].title).toBe("Thriller");
	});

	test("applies AND filter when both genre and decade are provided", async () => {
		queryResults = [
			[
				{
					id: "rel-3",
					title: "Parallel Lines",
					artist: "Blondie",
					label: "Chrysalis",
					format: "LP",
					year: 1978,
					genre: ["Rock", "New Wave"],
					rarityScore: 0.9,
					coverImageUrl: null,
					ownerCount: 5,
				},
			],
		];

		const results = await browseRecords("Rock", "70s");

		expect(results).toHaveLength(1);
		expect(results[0].artist).toBe("Blondie");
	});

	test("returns results when neither genre nor decade is provided", async () => {
		queryResults = [
			[
				{
					id: "rel-4",
					title: "Random Album",
					artist: "Random Artist",
					label: null,
					format: "LP",
					year: 2020,
					genre: null,
					rarityScore: null,
					coverImageUrl: null,
					ownerCount: 1,
				},
			],
		];

		const results = await browseRecords(null, null);

		expect(results).toHaveLength(1);
	});

	test("applies pagination with limit and offset", async () => {
		queryResults = [[]];

		await browseRecords("Jazz", null, 10, 20);

		expect(
			vi.mocked(db.limit as (n: number) => unknown),
		).toHaveBeenCalledWith(10);
		expect(
			vi.mocked(db.offset as (n: number) => unknown),
		).toHaveBeenCalledWith(20);
	});
});
