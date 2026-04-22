import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string } | null = { id: USER_ID };

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

vi.mock("@/lib/validations/discovery", () => ({
	searchRecordsSchema: {
		safeParse: vi.fn((val: { term: string }) => {
			if (val.term && val.term.length >= 2)
				return { success: true, data: { term: val.term } };
			return { success: false, error: { issues: [{ message: "Too short" }] } };
		}),
	},
	browseRecordsSchema: {
		safeParse: vi.fn((val: Record<string, unknown>) => ({
			success: true,
			data: {
				genre: val.genre ?? null,
				decade: val.decade ?? null,
				page: val.page ?? 1,
				genres: val.genres ?? [],
				country: val.country ?? null,
				format: val.format ?? null,
				minRarity: val.minRarity ?? 0,
			},
		})),
	},
}));

vi.mock("@/actions/search-signals", () => ({
	logSearchSignal: vi.fn(async () => {}),
}));

const mockSearchRecords = vi.fn(async (..._args: unknown[]) => [{ id: "r1", title: "Jazz LP" }]);
const mockBrowseRecords = vi.fn(async (..._args: unknown[]) => [{ id: "r2", title: "Funk LP" }]);
const mockGetSuggestedRecords = vi.fn(async (..._args: unknown[]) => [{ id: "r3", title: "Soul LP" }]);
const mockGetTrendingRecords = vi.fn(async (..._args: unknown[]) => [{ id: "r4", title: "Rock LP" }]);

vi.mock("@/lib/discovery/queries", () => ({
	searchRecords: (...args: unknown[]) => mockSearchRecords(...args),
	browseRecords: (...args: unknown[]) => mockBrowseRecords(...args),
	getSuggestedRecords: (...args: unknown[]) => mockGetSuggestedRecords(...args),
	getTrendingRecords: (...args: unknown[]) => mockGetTrendingRecords(...args),
}));

const {
	searchRecordsAction,
	browseRecordsAction,
	getSuggestionsAction,
	getTrendingAction,
} = await import("@/actions/discovery");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	vi.clearAllMocks();
});

describe("searchRecordsAction", () => {
	it("returns records for valid search term", async () => {
		const result = await searchRecordsAction("Jazz");
		expect(result).toHaveLength(1);
		expect(mockSearchRecords).toHaveBeenCalled();
	});

	it("returns empty array for too-short term", async () => {
		const result = await searchRecordsAction("J");
		expect(result).toEqual([]);
	});

	it("returns empty array for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await searchRecordsAction("Jazz");
		expect(result).toEqual([]);
	});
});

describe("browseRecordsAction", () => {
	it("returns records with genre filter", async () => {
		const result = await browseRecordsAction("Funk", null, 1);
		expect(result).toHaveLength(1);
		expect(mockBrowseRecords).toHaveBeenCalled();
	});

	it("returns empty for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await browseRecordsAction("Funk", null, 1);
		expect(result).toEqual([]);
	});
});

describe("getSuggestionsAction", () => {
	it("returns suggestions for authenticated user", async () => {
		const result = await getSuggestionsAction();
		expect(result).toHaveLength(1);
	});

	it("returns empty for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await getSuggestionsAction();
		expect(result).toEqual([]);
	});
});

describe("getTrendingAction", () => {
	it("returns trending records for authenticated user", async () => {
		const result = await getTrendingAction();
		expect(result).toHaveLength(1);
	});

	it("returns empty for unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await getTrendingAction();
		expect(result).toEqual([]);
	});
});
