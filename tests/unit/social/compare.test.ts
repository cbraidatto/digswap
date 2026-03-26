import { describe, test, expect, vi, beforeEach } from "vitest";

// -- Mock Drizzle db --
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

// -- Mock collections schema --
vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id" },
}));

// -- Mock releases schema --
vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		rarityScore: "rarity_score",
	},
}));

// -- Mock drizzle-orm --
vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	sql: vi.fn(),
	inArray: vi.fn(),
	desc: vi.fn(),
}));

import { getCollectionComparison } from "@/lib/social/comparison";

const MY_USER_ID = "user-uuid-001";
const THEIR_USER_ID = "user-uuid-002";

// Helper to create a chained select mock
function createSelectChain(resolvedRows: unknown[] = []) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.from = vi.fn().mockReturnValue(chain);
	chain.innerJoin = vi.fn().mockReturnValue(chain);
	chain.where = vi.fn().mockResolvedValue(resolvedRows);
	return chain;
}

describe("getCollectionComparison", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns correct uniqueToMe, inCommon, uniqueToThem for overlapping collections", async () => {
		// My collection: rel-1 (discogsId 100), rel-2 (discogsId 200)
		// Their collection: rel-2 (discogsId 200), rel-3 (discogsId 300)
		const myItems = [
			{ releaseId: "rel-1", discogsId: 100, title: "Kind of Blue", artist: "Miles Davis", rarityScore: 2.5 },
			{ releaseId: "rel-2", discogsId: 200, title: "A Love Supreme", artist: "John Coltrane", rarityScore: 1.8 },
		];
		const theirItems = [
			{ releaseId: "rel-2", discogsId: 200, title: "A Love Supreme", artist: "John Coltrane", rarityScore: 1.8 },
			{ releaseId: "rel-3", discogsId: 300, title: "Blue Train", artist: "John Coltrane", rarityScore: 1.2 },
		];

		const chain1 = createSelectChain(myItems);
		const chain2 = createSelectChain(theirItems);
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? chain1 : chain2;
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toHaveLength(1);
		expect(result.uniqueToMe[0].title).toBe("Kind of Blue");
		expect(result.inCommon).toHaveLength(1);
		expect(result.inCommon[0].title).toBe("A Love Supreme");
		expect(result.uniqueToThem).toHaveLength(1);
		expect(result.uniqueToThem[0].title).toBe("Blue Train");
	});

	test("matches on discogsId when both items have it", async () => {
		const myItems = [
			{ releaseId: "rel-1", discogsId: 100, title: "Kind of Blue", artist: "Miles Davis", rarityScore: 2.5 },
		];
		const theirItems = [
			// Different releaseId but same discogsId -- should match
			{ releaseId: "rel-99", discogsId: 100, title: "Kind of Blue", artist: "Miles Davis", rarityScore: 2.5 },
		];

		const chain1 = createSelectChain(myItems);
		const chain2 = createSelectChain(theirItems);
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? chain1 : chain2;
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toHaveLength(0);
		expect(result.inCommon).toHaveLength(1);
		expect(result.uniqueToThem).toHaveLength(0);
	});

	test("falls back to normalized artist+title when discogsId is null", async () => {
		const myItems = [
			{ releaseId: "rel-1", discogsId: null, title: "Kind of Blue", artist: "Miles Davis", rarityScore: 2.5 },
		];
		const theirItems = [
			// No discogsId either, but same artist+title (case-insensitive)
			{ releaseId: "rel-2", discogsId: null, title: "kind of blue", artist: "miles davis", rarityScore: 2.5 },
		];

		const chain1 = createSelectChain(myItems);
		const chain2 = createSelectChain(theirItems);
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? chain1 : chain2;
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toHaveLength(0);
		expect(result.inCommon).toHaveLength(1);
		expect(result.uniqueToThem).toHaveLength(0);
	});

	test("returns empty arrays for empty collections", async () => {
		const chain1 = createSelectChain([]);
		const chain2 = createSelectChain([]);
		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? chain1 : chain2;
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toEqual([]);
		expect(result.inCommon).toEqual([]);
		expect(result.uniqueToThem).toEqual([]);
	});
});
