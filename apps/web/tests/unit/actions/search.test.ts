import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-111111111111";

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

vi.mock("@/lib/validations/common", () => ({
	sanitizeWildcards: vi.fn((s: string) => s),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
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

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		coverImageUrl: "cover_image_url",
		year: "year",
		discogsId: "discogs_id",
		rarityScore: "rarity_score",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
		avatarUrl: "avatar_url",
	},
}));

const { globalSearchAction } = await import("@/actions/search");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("globalSearchAction", () => {
	it("returns empty results when not authenticated", async () => {
		mockAuthUser = null;
		const result = await globalSearchAction("test query");
		expect(result).toEqual({ records: [], users: [] });
	});

	it("returns empty results for query too short", async () => {
		const result = await globalSearchAction("a");
		expect(result).toEqual({ records: [], users: [] });
	});

	it("returns empty results for query too long", async () => {
		const result = await globalSearchAction("x".repeat(201));
		expect(result).toEqual({ records: [], users: [] });
	});

	it("returns records and users for valid query", async () => {
		const mockRecords = [{ id: "r1", discogsId: 123, title: "Blue Train", artist: "Coltrane", coverImageUrl: null, year: 1957 }];
		const mockUsers = [{ id: "u1", username: "digger1", displayName: "Digger One", avatarUrl: null }];
		selectResults = [mockRecords, mockUsers];

		const result = await globalSearchAction("blue train");
		expect(result.records).toEqual(mockRecords);
		expect(result.users).toEqual(mockUsers);
	});

	it("returns empty results when db returns nothing", async () => {
		selectResults = [[], []];
		const result = await globalSearchAction("nonexistent");
		expect(result.records).toEqual([]);
		expect(result.users).toEqual([]);
	});
});
