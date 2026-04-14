import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: mockAuthUser ? null : { message: "Not auth" },
			})),
		},
	})),
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

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		userId: "user_id",
		releaseId: "release_id",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		genre: "genre",
		rarityScore: "rarity_score",
	},
}));

vi.mock("@/lib/db/schema/reviews", () => ({
	reviews: {
		userId: "user_id",
		createdAt: "created_at",
	},
}));

vi.mock("@/lib/db/schema/social", () => ({
	follows: {
		followingId: "following_id",
		createdAt: "created_at",
	},
}));

const { generateWrapped } = await import("@/actions/wrapped");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("generateWrapped", () => {
	it("returns null when not authenticated", async () => {
		mockAuthUser = null;
		const result = await generateWrapped(USER_ID, 2025);
		expect(result).toBeNull();
	});

	it("returns null when userId does not match authenticated user", async () => {
		const result = await generateWrapped(OTHER_USER, 2025);
		expect(result).toBeNull();
	});

	it("returns null when user has no items for the year", async () => {
		selectResults = [
			[], // collection items query returns empty
		];
		const result = await generateWrapped(USER_ID, 2025);
		expect(result).toBeNull();
	});

	it("returns wrapped stats for valid user with data", async () => {
		const items = [
			{ title: "Blue Train", artist: "Coltrane", genre: ["Jazz", "Hard Bop"], rarityScore: 0.8 },
			{ title: "Kind of Blue", artist: "Miles Davis", genre: ["Jazz"], rarityScore: 0.6 },
			{ title: "A Love Supreme", artist: "Coltrane", genre: ["Jazz", "Spiritual Jazz"], rarityScore: 0.9 },
		];

		selectResults = [
			items,                      // collection items
			[{ count: 5 }],           // reviews count
			[{ count: 10 }],          // followers gained
		];

		const result = await generateWrapped(USER_ID, 2025);
		expect(result).not.toBeNull();
		expect(result!.recordsAdded).toBe(3);
		expect(result!.reviewsWritten).toBe(5);
		expect(result!.followersGained).toBe(10);
		expect(result!.topGenres[0].name).toBe("Jazz");
		expect(result!.topArtists[0].name).toBe("Coltrane");
		expect(result!.rarestFind?.title).toBe("A Love Supreme");
		expect(result!.totalValue).toBe("Getting started");
		expect(result!.year).toBe(2025);
	});

	it("uses current year when year not provided", async () => {
		selectResults = [[]]; // empty items
		const result = await generateWrapped(USER_ID);
		expect(result).toBeNull(); // null because no items, but should not throw
	});

	it("assigns correct totalValue tiers", async () => {
		// 25 items => "Growing"
		const items = Array.from({ length: 25 }, (_, i) => ({
			title: `Record ${i}`,
			artist: "Artist",
			genre: ["Rock"],
			rarityScore: 0.5,
		}));

		selectResults = [items, [{ count: 0 }], [{ count: 0 }]];
		const result = await generateWrapped(USER_ID, 2025);
		expect(result!.totalValue).toBe("Growing");
	});
});
