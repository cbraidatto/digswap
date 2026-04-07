import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];
let executeResult: unknown[] = [];

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

	// db.execute for raw SQL queries (genre leaderboard)
	chain.execute = vi.fn().mockImplementation(() => ({
		then: (resolve: (v: unknown) => void) => resolve(executeResult),
	}));

	return { db: chain };
});

// ---------------------------------------------------------------------------
// Schema mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/schema/gamification", () => ({
	userRankings: {
		userId: "user_id",
		rarityScore: "rarity_score",
		contributionScore: "contribution_score",
		globalRank: "global_rank",
		title: "title",
	},
	badges: {
		id: "id",
		slug: "slug",
		name: "name",
		description: "description",
	},
	userBadges: {
		userId: "user_id",
		badgeId: "badge_id",
		earnedAt: "earned_at",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
	},
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
	and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
	asc: vi.fn((...args: unknown[]) => ({ type: "asc", args })),
	desc: vi.fn((...args: unknown[]) => ({ type: "desc", args })),
	sql: Object.assign(
		vi.fn((...args: unknown[]) => ({ type: "sql", args })),
		{ raw: vi.fn() },
	),
	count: vi.fn(),
}));

import { db } from "@/lib/db";
// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import {
	getGenreLeaderboard,
	getGlobalLeaderboard,
	getUserBadges,
} from "@/lib/gamification/queries";

describe("getGlobalLeaderboard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
		executeResult = [];
	});

	test("returns entries ordered by globalRank", async () => {
		queryResults = [
			[
				{
					userId: "u1",
					username: "wax_prophet",
					displayName: "Wax",
					globalRank: 1,
					title: "Wax Prophet",
					globalScore: 847.3,
				},
				{
					userId: "u2",
					username: "vinyl_king",
					displayName: "King",
					globalRank: 2,
					title: "Crate Digger",
					globalScore: 623.1,
				},
			],
		];

		const result = await getGlobalLeaderboard();

		expect(result).toHaveLength(2);
		expect(result[0].globalRank).toBe(1);
		expect(result[1].globalRank).toBe(2);
		expect(result[0].username).toBe("wax_prophet");
	});

	test("returns empty array when no rankings exist", async () => {
		queryResults = [[]];

		const result = await getGlobalLeaderboard();

		expect(result).toEqual([]);
	});

	test("respects page and pageSize parameters", async () => {
		queryResults = [[]];

		await getGlobalLeaderboard(2, 10);

		// Verify the chain methods were called with correct pagination args
		const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
		expect(mockDb.limit).toHaveBeenCalledWith(10);
		expect(mockDb.offset).toHaveBeenCalledWith(10);
	});
});

describe("getGenreLeaderboard", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
		executeResult = [];
	});

	test("filters to only users with records in requested genre (GAME-03)", async () => {
		executeResult = [
			{
				userId: "u1",
				username: "jazz_cat",
				displayName: "Jazz Cat",
				globalRank: 1,
				title: "Wax Prophet",
				globalScore: 42.7,
			},
		];

		const result = await getGenreLeaderboard("Jazz");

		expect(result).toHaveLength(1);
		expect(result[0].username).toBe("jazz_cat");
		expect(result[0].globalScore).toBe(42.7);
	});

	test("returns empty array for genre with no users", async () => {
		executeResult = [];

		const result = await getGenreLeaderboard("Classical");

		expect(result).toEqual([]);
	});

	test("uses genre-specific gem score, not global score", async () => {
		// The genre leaderboard computes SUM(gem_weight CASE) per genre
		// which differs from the global gem score
		executeResult = [
			{
				userId: "u1",
				username: "jazz_cat",
				displayName: "Jazz Cat",
				globalRank: 1,
				title: "Wax Prophet",
				globalScore: 42.7, // Genre-specific, not global 847.3
			},
		];

		const result = await getGenreLeaderboard("Jazz");

		expect(result[0].globalScore).toBe(42.7);
	});

	test("calls db.execute for raw SQL genre query", async () => {
		executeResult = [];

		await getGenreLeaderboard("Jazz");

		const mockDb = db as unknown as Record<string, ReturnType<typeof vi.fn>>;
		expect(mockDb.execute).toHaveBeenCalled();
	});
});

describe("getUserBadges", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
		executeResult = [];
	});

	test("returns earned badges ordered by earnedAt", async () => {
		queryResults = [
			[
				{
					slug: "first_dig",
					name: "FIRST_DIG",
					description: "Completed your first Discogs import",
					earnedAt: new Date("2026-01-01"),
				},
				{
					slug: "critic",
					name: "CRITIC",
					description: "Wrote your first review",
					earnedAt: new Date("2026-02-01"),
				},
			],
		];

		const result = await getUserBadges("user-1");

		expect(result).toHaveLength(2);
		expect(result[0].slug).toBe("first_dig");
		expect(result[1].slug).toBe("critic");
	});

	test("returns empty array for user with no badges", async () => {
		queryResults = [[]];

		const result = await getUserBadges("user-1");

		expect(result).toEqual([]);
	});
});
