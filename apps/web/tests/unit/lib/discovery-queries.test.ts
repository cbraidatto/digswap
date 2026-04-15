import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select",
		"from",
		"where",
		"orderBy",
		"limit",
		"offset",
		"innerJoin",
		"groupBy",
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

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args) => args),
	count: vi.fn(() => ({ as: vi.fn(() => "count_alias") })),
	countDistinct: vi.fn(() => ({ as: vi.fn(() => "count_distinct") })),
	desc: vi.fn((col) => col),
	eq: vi.fn((a, b) => ({ a, b })),
	gte: vi.fn((a, b) => ({ a, b })),
	ilike: vi.fn((col, pattern) => ({ col, pattern })),
	inArray: vi.fn((col, arr) => ({ col, arr })),
	isNull: vi.fn((col) => ({ col, op: "isNull" })),
	ne: vi.fn((a, b) => ({ a, b })),
	or: vi.fn((...args) => args),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({
			strings,
			values,
			as: vi.fn(() => "sql_alias"),
		}),
		{ raw: vi.fn() },
	),
}));

vi.mock("@/lib/collection/filters", () => ({
	getDecadeRange: vi.fn((decade: string) => {
		const d = parseInt(decade);
		return d ? { start: d, end: d + 10 } : null;
	}),
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		conditionGrade: "condition_grade",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		label: "label",
		format: "format",
		year: "year",
		genre: "genre",
		style: "style",
		country: "country",
		rarityScore: "rarity_score",
		coverImageUrl: "cover_image_url",
		youtubeVideoId: "youtube_video_id",
	},
}));

vi.mock("@/lib/db/schema/social", () => ({
	follows: { followerId: "follower_id", followingId: "following_id" },
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		avatarUrl: "avatar_url",
		displayName: "display_name",
	},
}));

const { searchRecords, getTrendingRecords, getSuggestedRecords } = await import(
	"@/lib/discovery/queries"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("searchRecords", () => {
	it("returns empty array for empty search term", async () => {
		const result = await searchRecords("");
		expect(result).toEqual([]);
	});

	it("returns empty array for whitespace-only term", async () => {
		const result = await searchRecords("   ");
		expect(result).toEqual([]);
	});

	it("returns results with owners grouped by release", async () => {
		selectResults = [
			// Matching releases
			[
				{
					id: "rel-1",
					discogsId: 123,
					title: "Blue Train",
					artist: "John Coltrane",
					label: "Blue Note",
					format: "Vinyl",
					year: 1957,
					genre: ["Jazz"],
					rarityScore: 3.5,
					coverImageUrl: "https://img.com/cover.jpg",
					youtubeVideoId: null,
				},
			],
			// Owner rows
			[
				{
					releaseId: "rel-1",
					userId: "owner-1",
					username: "digger42",
					avatarUrl: null,
					conditionGrade: "VG+",
				},
			],
		];

		const result = await searchRecords("Blue Train");
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Blue Train");
		expect(result[0].owners).toHaveLength(1);
		expect(result[0].owners[0].username).toBe("digger42");
		expect(result[0].ownerCount).toBe(1);
	});

	it("returns empty array when no releases match", async () => {
		selectResults = [[]];
		const result = await searchRecords("Nonexistent Album");
		expect(result).toEqual([]);
	});

	it("handles releases with no owners", async () => {
		selectResults = [
			[
				{
					id: "rel-1",
					discogsId: 123,
					title: "Rare Album",
					artist: "Unknown",
					label: null,
					format: null,
					year: null,
					genre: null,
					rarityScore: null,
					coverImageUrl: null,
					youtubeVideoId: null,
				},
			],
			[], // No owners
		];

		const result = await searchRecords("Rare Album");
		expect(result).toHaveLength(1);
		expect(result[0].owners).toEqual([]);
		expect(result[0].ownerCount).toBe(0);
	});
});

describe("getTrendingRecords", () => {
	it("returns trending records with numeric addCount", async () => {
		selectResults = [
			[
				{
					id: "rel-1",
					discogsId: 456,
					title: "Kind of Blue",
					artist: "Miles Davis",
					coverImageUrl: "https://img.com/kob.jpg",
					youtubeVideoId: null,
					rarityScore: 2.5,
					addCount: "12",
				},
			],
		];

		const result = await getTrendingRecords(10);
		expect(result).toHaveLength(1);
		expect(result[0].addCount).toBe(12);
		expect(typeof result[0].addCount).toBe("number");
	});

	it("returns empty array when no recent additions", async () => {
		selectResults = [[]];
		const result = await getTrendingRecords();
		expect(result).toEqual([]);
	});
});

describe("getSuggestedRecords", () => {
	it("returns empty when user has no genres and no follows", async () => {
		selectResults = [
			[], // Top genres
			[], // Followed users
		];

		const result = await getSuggestedRecords(USER_ID);
		expect(result).toEqual([]);
	});

	it("returns genre-based suggestions", async () => {
		selectResults = [
			// Top genres
			[{ genre: "Jazz", genreCount: 10 }],
			// Genre suggestions
			[
				{
					id: "rel-1",
					discogsId: 789,
					title: "A Love Supreme",
					artist: "John Coltrane",
					label: "Impulse!",
					format: "Vinyl",
					year: 1965,
					genre: ["Jazz"],
					rarityScore: 4.2,
					coverImageUrl: null,
					youtubeVideoId: null,
					ownerCount: "3",
				},
			],
			// Followed users (empty)
			[],
		];

		const result = await getSuggestedRecords(USER_ID, 8);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("A Love Supreme");
		expect(result[0].ownerCount).toBe(3);
	});

	it("deduplicates results from genre and follow suggestions", async () => {
		const sharedRecord = {
			id: "rel-1",
			discogsId: 789,
			title: "Shared Record",
			artist: "Artist",
			label: null,
			format: null,
			year: null,
			genre: null,
			rarityScore: null,
			coverImageUrl: null,
			youtubeVideoId: null,
			ownerCount: "1",
		};

		selectResults = [
			// Top genres
			[{ genre: "Jazz", genreCount: 10 }],
			// Genre suggestions
			[sharedRecord],
			// Followed users
			[{ followingId: "followed-1" }],
			// Follow suggestions (same record)
			[sharedRecord],
		];

		const result = await getSuggestedRecords(USER_ID, 8);
		// Should deduplicate
		const ids = result.map((r) => r.id);
		expect(new Set(ids).size).toBe(ids.length);
	});
});
