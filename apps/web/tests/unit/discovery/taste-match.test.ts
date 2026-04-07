import { beforeEach, describe, expect, test, vi } from "vitest";

// Track call count to return different results for sequential queries.
// The new getSuggestedRecords removes the "ownedIds" prefetch query —
// exclusion is done via NOT EXISTS subquery in the DB.
// Query order is now:
//   1. topGenres
//   2. genreSuggestions (only if genres exist)
//   3. followedUsers
//   4. followSuggestions (only if followed users exist)
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
	getDecadeRange: vi.fn(),
}));

import { getSuggestedRecords } from "@/lib/discovery/queries";

describe("getSuggestedRecords", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns records in user's top genres they don't own", async () => {
		queryResults = [
			// Query 1: top genres
			[
				{ genre: "Jazz", genreCount: 10 },
				{ genre: "Soul", genreCount: 5 },
			],
			// Query 2: genre-based suggestions (NOT EXISTS handles owned exclusion in DB)
			[
				{
					id: "sug-1",
					title: "Blue Train",
					artist: "John Coltrane",
					label: "Blue Note",
					format: "LP",
					year: 1958,
					genre: ["Jazz"],
					rarityScore: 1.8,
					coverImageUrl: null,
					ownerCount: 2,
				},
			],
			// Query 3: followed users
			[],
			// No follow suggestions (no followed users)
		];

		const results = await getSuggestedRecords("user-1");

		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].title).toBe("Blue Train");
	});

	test("returns records from followed users they don't own", async () => {
		queryResults = [
			// Query 1: top genres (empty — user has no genres)
			[],
			// No genre suggestions since no genres
			// Query 2: followed users
			[{ followingId: "friend-1" }],
			// Query 3: follow suggestions (NOT EXISTS handles owned exclusion in DB)
			[
				{
					id: "sug-2",
					title: "Innervisions",
					artist: "Stevie Wonder",
					label: "Tamla",
					format: "LP",
					year: 1973,
					genre: ["Soul"],
					rarityScore: 1.2,
					coverImageUrl: null,
					ownerCount: 1,
				},
			],
		];

		const results = await getSuggestedRecords("user-1");

		expect(results.length).toBeGreaterThanOrEqual(1);
		expect(results[0].title).toBe("Innervisions");
	});

	test("returns empty array when user has no collection and no follows", async () => {
		queryResults = [
			// Query 1: top genres (empty)
			[],
			// No genre suggestions
			// Query 2: followed users (empty)
			[],
			// No follow suggestions
		];

		const results = await getSuggestedRecords("user-1");

		expect(results).toEqual([]);
	});

	test("deduplicates records across genre and follow sources", async () => {
		const sharedRecord = {
			id: "shared-1",
			title: "Maiden Voyage",
			artist: "Herbie Hancock",
			label: "Blue Note",
			format: "LP",
			year: 1965,
			genre: ["Jazz"],
			rarityScore: 1.5,
			coverImageUrl: null,
			ownerCount: 3,
		};

		queryResults = [
			// Query 1: top genres
			[{ genre: "Jazz", genreCount: 10 }],
			// Query 2: genre suggestions (contains sharedRecord)
			[sharedRecord],
			// Query 3: followed users
			[{ followingId: "friend-1" }],
			// Query 4: follow suggestions (same record)
			[sharedRecord],
		];

		const results = await getSuggestedRecords("user-1", 8);

		// Should deduplicate — only one instance of shared-1
		const ids = results.map((r) => r.id);
		const uniqueIds = new Set(ids);
		expect(uniqueIds.size).toBe(ids.length);
		expect(results.filter((r) => r.id === "shared-1")).toHaveLength(1);
	});
});
