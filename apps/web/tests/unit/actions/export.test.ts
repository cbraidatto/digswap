import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin"];
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

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id", conditionGrade: "condition_grade", addedVia: "added_via", createdAt: "created_at" },
}));
vi.mock("@/lib/db/schema/releases", () => ({
	releases: { id: "id", title: "title", artist: "artist", year: "year", genre: "genre", style: "style", format: "format", label: "label", country: "country", discogsId: "discogs_id", rarityScore: "rarity_score" },
}));
vi.mock("@/lib/db/schema/wantlist", () => ({
	wantlistItems: { userId: "user_id", releaseId: "release_id", createdAt: "created_at" },
}));

const { exportCollectionCsv, exportWantlistCsv } = await import("@/actions/export");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("exportCollectionCsv", () => {
	it("returns CSV for authenticated user with items", async () => {
		selectResults = [
			[
				{
					title: "Kind of Blue",
					artist: "Miles Davis",
					year: 1959,
					genre: ["Jazz"],
					style: ["Modal"],
					format: "LP",
					label: "Columbia",
					country: "US",
					conditionGrade: "VG+",
					addedVia: "discogs",
					discogsId: 123,
					rarityScore: 85.5,
					createdAt: new Date("2025-01-01"),
				},
			],
		];

		const result = await exportCollectionCsv();
		expect(result.csv).toBeDefined();
		expect(result.csv).toContain("Kind of Blue");
		expect(result.csv).toContain("Miles Davis");
		expect(result.csv).toContain("Title,Artist");
	});

	it("returns CSV with header only for empty collection", async () => {
		selectResults = [[]];
		const result = await exportCollectionCsv();
		expect(result.csv).toBeDefined();
		expect(result.csv).toContain("Title,Artist");
		// Only the header line
		expect(result.csv!.split("\n")).toHaveLength(1);
	});

	it("returns error for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await exportCollectionCsv();
		expect(result.error).toBeDefined();
	});

	it("escapes CSV values with commas", async () => {
		selectResults = [
			[
				{
					title: "Hello, World",
					artist: 'The "Quotes"',
					year: 2000,
					genre: null,
					style: null,
					format: null,
					label: null,
					country: null,
					conditionGrade: null,
					addedVia: null,
					discogsId: null,
					rarityScore: null,
					createdAt: new Date("2025-01-01"),
				},
			],
		];
		const result = await exportCollectionCsv();
		expect(result.csv).toContain('"Hello, World"');
	});
});

describe("exportWantlistCsv", () => {
	it("returns CSV for authenticated user", async () => {
		selectResults = [
			[
				{
					title: "A Love Supreme",
					artist: "John Coltrane",
					year: 1965,
					genre: ["Jazz"],
					format: "LP",
					label: "Impulse!",
					discogsId: 456,
					rarityScore: 90,
					createdAt: new Date("2025-03-01"),
				},
			],
		];

		const result = await exportWantlistCsv();
		expect(result.csv).toBeDefined();
		expect(result.csv).toContain("A Love Supreme");
	});

	it("returns error for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await exportWantlistCsv();
		expect(result.error).toBeDefined();
	});
});
