import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MY_ID = "user-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const THEIR_ID = "user-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let promiseAllResults: unknown[][] = [];

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin", "as"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	// The comparison module uses Promise.all with 3 queries
	// We need the chain to be thenable so each query in Promise.all resolves
	let callIndex = 0;
	chain.then = (resolve: (v: unknown) => void) => {
		const result = promiseAllResults[callIndex] ?? [];
		callIndex++;
		return resolve(result);
	};

	// Reset call index for each test via a hidden reset
	(chain as Record<string, unknown>).__resetIndex = () => {
		callIndex = 0;
	};

	return { db: chain };
});

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		visibility: "visibility",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		discogsId: "discogs_id",
		rarityScore: "rarity_score",
		coverImageUrl: "cover_image_url",
	},
}));

const { getCollectionComparison } = await import("@/lib/social/comparison");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compItem(overrides?: Record<string, unknown>) {
	return {
		releaseId: "rel-1",
		discogsId: 12345,
		title: "Kind of Blue",
		artist: "Miles Davis",
		rarityScore: 85,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(async () => {
	promiseAllResults = [];
	const { db } = vi.mocked(await import("@/lib/db"));
	(db as unknown as Record<string, () => void>).__resetIndex?.();
	vi.clearAllMocks();
});

describe("getCollectionComparison", () => {
	it("returns three categories of comparison", async () => {
		const common = [compItem({ releaseId: "r-common" })];
		const uniqueMe = [compItem({ releaseId: "r-mine", title: "My Record" })];
		const uniqueThem = [compItem({ releaseId: "r-theirs", title: "Their Record" })];

		promiseAllResults = [common, uniqueMe, uniqueThem];

		const result = await getCollectionComparison(MY_ID, THEIR_ID);
		expect(result.inCommon).toEqual(common);
		expect(result.uniqueToMe).toEqual(uniqueMe);
		expect(result.uniqueToThem).toEqual(uniqueThem);
	});

	it("returns empty arrays when no overlap", async () => {
		promiseAllResults = [[], [], []];

		const result = await getCollectionComparison(MY_ID, THEIR_ID);
		expect(result.inCommon).toEqual([]);
		expect(result.uniqueToMe).toEqual([]);
		expect(result.uniqueToThem).toEqual([]);
	});

	it("handles case with all records in common", async () => {
		const common = [
			compItem({ releaseId: "r-1" }),
			compItem({ releaseId: "r-2", title: "A Love Supreme" }),
		];
		promiseAllResults = [common, [], []];

		const result = await getCollectionComparison(MY_ID, THEIR_ID);
		expect(result.inCommon).toHaveLength(2);
		expect(result.uniqueToMe).toEqual([]);
		expect(result.uniqueToThem).toEqual([]);
	});

	it("handles null rarity scores", async () => {
		const item = compItem({ rarityScore: null });
		promiseAllResults = [[item], [], []];

		const result = await getCollectionComparison(MY_ID, THEIR_ID);
		expect(result.inCommon[0].rarityScore).toBeNull();
	});
});
