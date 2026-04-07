import { beforeEach, describe, expect, test, vi } from "vitest";

// The new getCollectionComparison runs 3 DB queries via Promise.all.
// Each query returns the already-computed result from the DB JOIN.
// We mock the chain to return DB-pre-computed results.

const mockSelect = vi.fn();

vi.mock("@/lib/db", () => ({
	db: {
		select: (...args: unknown[]) => mockSelect(...args),
		insert: vi.fn(),
		delete: vi.fn(),
	},
}));

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id" },
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		rarityScore: "rarity_score",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	sql: Object.assign(vi.fn(), { join: vi.fn() }),
	inArray: vi.fn(),
	desc: vi.fn(),
}));

import { getCollectionComparison } from "@/lib/social/comparison";

const MY_USER_ID = "user-uuid-001";
const THEIR_USER_ID = "user-uuid-002";

// Helper: chain resolves to rows
function createSelectChain(resolvedRows: unknown[] = []) {
	const chain: Record<string, unknown> = {};
	// All query builder methods return `this` chain, not the global db mock
	const methods = ["from", "innerJoin", "where", "orderBy", "as"];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	// limit resolves the promise with the pre-set rows
	chain.limit = vi.fn().mockResolvedValue(resolvedRows);
	// also make the chain itself thenable (in case it's awaited without .limit)
	chain.then = (resolve: (v: unknown) => void) => Promise.resolve(resolvedRows).then(resolve);
	chain.as = vi.fn().mockReturnValue(chain);
	return chain;
}

describe("getCollectionComparison", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns correct uniqueToMe, inCommon, uniqueToThem for overlapping collections", async () => {
		// The new implementation runs 3 queries in Promise.all:
		// query 1 → inCommon, query 2 → uniqueToMe, query 3 → uniqueToThem
		const inCommonRows = [
			{
				releaseId: "rel-2",
				discogsId: 200,
				title: "A Love Supreme",
				artist: "John Coltrane",
				rarityScore: 1.8,
			},
		];
		const uniqueToMeRows = [
			{
				releaseId: "rel-1",
				discogsId: 100,
				title: "Kind of Blue",
				artist: "Miles Davis",
				rarityScore: 2.5,
			},
		];
		const uniqueToThemRows = [
			{
				releaseId: "rel-3",
				discogsId: 300,
				title: "Blue Train",
				artist: "John Coltrane",
				rarityScore: 1.2,
			},
		];

		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			// callCount === 1: main inCommon query (db.select(selectFields) evaluated first)
			if (callCount === 1) return createSelectChain(inCommonRows);
			// callCount === 2: subquery (db.select({releaseId}) inside innerJoin arg — evaluated 2nd)
			if (callCount === 2) return createSelectChain([]);
			// callCount === 3: uniqueToMe query
			if (callCount === 3) return createSelectChain(uniqueToMeRows);
			// callCount === 4: uniqueToThem query
			return createSelectChain(uniqueToThemRows);
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toHaveLength(1);
		expect(result.uniqueToMe[0].title).toBe("Kind of Blue");
		expect(result.inCommon).toHaveLength(1);
		expect(result.inCommon[0].title).toBe("A Love Supreme");
		expect(result.uniqueToThem).toHaveLength(1);
		expect(result.uniqueToThem[0].title).toBe("Blue Train");
	});

	test("returns empty arrays when no overlap", async () => {
		const uniqueToMeRows = [
			{
				releaseId: "rel-1",
				discogsId: 100,
				title: "Kind of Blue",
				artist: "Miles Davis",
				rarityScore: 2.5,
			},
		];
		const uniqueToThemRows = [
			{
				releaseId: "rel-3",
				discogsId: 300,
				title: "Blue Train",
				artist: "John Coltrane",
				rarityScore: 1.2,
			},
		];

		let callCount = 0;
		mockSelect.mockImplementation(() => {
			callCount++;
			if (callCount === 1) return createSelectChain([]); // inCommon
			if (callCount === 2) return createSelectChain(uniqueToMeRows);
			return createSelectChain(uniqueToThemRows);
		});

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.inCommon).toEqual([]);
		expect(result.uniqueToMe).toHaveLength(1);
		expect(result.uniqueToThem).toHaveLength(1);
	});

	test("returns empty arrays for empty collections", async () => {
		mockSelect.mockImplementation(() => createSelectChain([]));

		const result = await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		expect(result.uniqueToMe).toEqual([]);
		expect(result.inCommon).toEqual([]);
		expect(result.uniqueToThem).toEqual([]);
	});

	test("runs exactly 3 DB queries via Promise.all", async () => {
		mockSelect.mockImplementation(() => createSelectChain([]));

		await getCollectionComparison(MY_USER_ID, THEIR_USER_ID);

		// 4 select calls: 1 subquery (inCommon innerJoin) + 3 main queries
		expect(mockSelect).toHaveBeenCalledTimes(4);
	});
});
