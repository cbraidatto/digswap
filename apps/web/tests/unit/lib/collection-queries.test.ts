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
		"selectDistinct",
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
	asc: vi.fn((col) => col),
	desc: vi.fn((col) => col),
	eq: vi.fn((a, b) => ({ a, b })),
	gte: vi.fn((a, b) => ({ a, b })),
	ilike: vi.fn((col, pattern) => ({ col, pattern })),
	isNull: vi.fn((col) => ({ col, op: "isNull" })),
	lt: vi.fn((a, b) => ({ a, b })),
	ne: vi.fn((a, b) => ({ a, b })),
	or: vi.fn((...args) => args),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({
			strings,
			values,
		}),
		{ raw: vi.fn() },
	),
}));

vi.mock("next/cache", () => ({
	unstable_cache: vi.fn((fn) => fn),
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		conditionGrade: "condition_grade",
		addedVia: "added_via",
		createdAt: "created_at",
		notes: "notes",
		personalRating: "personal_rating",
		visibility: "visibility",
		audioFormat: "audio_format",
		bitrate: "bitrate",
		sampleRate: "sample_rate",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		year: "year",
		genre: "genre",
		format: "format",
		label: "label",
		coverImageUrl: "cover_image_url",
		rarityScore: "rarity_score",
		youtubeVideoId: "youtube_video_id",
		tracklist: "tracklist",
		style: "style",
		country: "country",
	},
}));

vi.mock("@/lib/collection/filters", () => ({
	getDecadeRange: vi.fn((decade: string) => {
		const d = parseInt(decade);
		return d ? { start: d, end: d + 10 } : null;
	}),
}));

const { getCollectionPage, getCollectionCount, PAGE_SIZE } = await import(
	"@/lib/collection/queries"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("PAGE_SIZE", () => {
	it("is 24", () => {
		expect(PAGE_SIZE).toBe(24);
	});
});

describe("getCollectionPage", () => {
	const defaultFilters = { page: 1, sort: "rarity" };

	it("returns mapped collection items", async () => {
		selectResults = [
			[
				{
					id: "ci-1",
					conditionGrade: "VG+",
					addedVia: "discogs_import",
					createdAt: new Date("2026-01-01"),
					releaseId: "rel-1",
					discogsId: 123,
					title: "Blue Train",
					artist: "John Coltrane",
					year: 1957,
					genre: ["Jazz"],
					format: "Vinyl",
					coverImageUrl: "https://img.com/cover.jpg",
					rarityScore: 3.5,
					youtubeVideoId: null,
					notes: "Great pressing",
					tracklist: [{ position: "A1", title: "Blue Train", duration: "10:44" }],
					personalRating: 5,
					visibility: "public",
					audioFormat: "FLAC",
					bitrate: 1411,
					sampleRate: 44100,
				},
			],
		];

		const result = await getCollectionPage(USER_ID, defaultFilters);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("Blue Train");
		expect(result[0].conditionGrade).toBe("VG+");
		expect(result[0].openForTrade).toBe(0); // visibility=public -> 0
		expect(result[0].tracklist).toHaveLength(1);
	});

	it("derives openForTrade from visibility=tradeable", async () => {
		selectResults = [
			[
				{
					id: "ci-1",
					conditionGrade: null,
					addedVia: null,
					createdAt: new Date(),
					releaseId: "rel-1",
					discogsId: null,
					title: "Test",
					artist: "Test",
					year: null,
					genre: null,
					format: null,
					coverImageUrl: null,
					rarityScore: null,
					youtubeVideoId: null,
					notes: null,
					tracklist: null,
					personalRating: null,
					visibility: "tradeable",
					audioFormat: null,
					bitrate: null,
					sampleRate: null,
				},
			],
		];

		const result = await getCollectionPage(USER_ID, defaultFilters);
		expect(result[0].openForTrade).toBe(1);
	});

	it("handles null tracklist gracefully", async () => {
		selectResults = [
			[
				{
					id: "ci-1",
					conditionGrade: null,
					addedVia: null,
					createdAt: new Date(),
					releaseId: "rel-1",
					discogsId: null,
					title: "Test",
					artist: "Test",
					year: null,
					genre: null,
					format: null,
					coverImageUrl: null,
					rarityScore: null,
					youtubeVideoId: null,
					notes: null,
					tracklist: null,
					personalRating: null,
					visibility: "public",
					audioFormat: null,
					bitrate: null,
					sampleRate: null,
				},
			],
		];

		const result = await getCollectionPage(USER_ID, defaultFilters);
		expect(result[0].tracklist).toBeNull();
	});

	it("returns empty array when no items match", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, defaultFilters);
		expect(result).toEqual([]);
	});

	it("accepts excludePrivate option", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, defaultFilters, {
			excludePrivate: true,
		});
		expect(result).toEqual([]);
	});

	it("accepts genre filter", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, {
			...defaultFilters,
			genre: "Jazz",
		});
		expect(result).toEqual([]);
	});

	it("accepts decade filter", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, {
			...defaultFilters,
			decade: "1960",
		});
		expect(result).toEqual([]);
	});

	it("accepts search filter", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, {
			...defaultFilters,
			search: "Coltrane",
		});
		expect(result).toEqual([]);
	});

	it("accepts sort=date", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, {
			...defaultFilters,
			sort: "date",
		});
		expect(result).toEqual([]);
	});

	it("accepts sort=alpha", async () => {
		selectResults = [[]];
		const result = await getCollectionPage(USER_ID, {
			...defaultFilters,
			sort: "alpha",
		});
		expect(result).toEqual([]);
	});
});

describe("getCollectionCount", () => {
	const defaultFilters = { page: 1, sort: "rarity" };

	it("returns numeric count", async () => {
		selectResults = [[{ count: "42" }]];
		const result = await getCollectionCount(USER_ID, defaultFilters);
		expect(result).toBe(42);
	});

	it("returns 0 when no items", async () => {
		selectResults = [[{ count: "0" }]];
		const result = await getCollectionCount(USER_ID, defaultFilters);
		expect(result).toBe(0);
	});

	it("returns 0 when result is empty", async () => {
		selectResults = [[]];
		const result = await getCollectionCount(USER_ID, defaultFilters);
		expect(result).toBe(0);
	});

	it("accepts excludePrivate option", async () => {
		selectResults = [[{ count: "10" }]];
		const result = await getCollectionCount(USER_ID, defaultFilters, {
			excludePrivate: true,
		});
		expect(result).toBe(10);
	});
});
