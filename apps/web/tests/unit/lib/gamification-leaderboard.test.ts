import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let selectResults: unknown[][] = [];
let queryCallCount = 0;
let executeResult: unknown[] = [];

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "offset", "innerJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	chain.execute = vi.fn().mockImplementation(() => {
		return Promise.resolve(executeResult);
	});

	return { db: chain };
});

vi.mock("drizzle-orm", () => ({
	asc: vi.fn((col) => col),
	desc: vi.fn((col) => col),
	eq: vi.fn((a, b) => ({ a, b })),
	sql: Object.assign(
		(strings: TemplateStringsArray, ...values: unknown[]) => ({
			strings,
			values,
		}),
		{ raw: vi.fn() },
	),
}));

vi.mock("react", () => ({
	cache: vi.fn((fn) => fn),
}));

vi.mock("@/lib/db/schema/gamification", () => ({
	badges: { slug: "slug", name: "name", description: "description", id: "id" },
	userBadges: { badgeId: "badge_id", userId: "user_id", earnedAt: "earned_at" },
	userRankings: {
		userId: "user_id",
		globalRank: "global_rank",
		title: "title",
		rarityScore: "rarity_score",
		contributionScore: "contribution_score",
	},
}));

vi.mock("@/lib/db/schema/users", () => ({
	profiles: {
		id: "id",
		username: "username",
		displayName: "display_name",
	},
}));

const {
	getGlobalLeaderboard,
	getGenreLeaderboard,
	getUserRanking,
	getUserBadges,
	getLeaderboardCount,
	getGenreLeaderboardCount,
} = await import("@/lib/gamification/queries");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	executeResult = [];
	vi.clearAllMocks();
});

describe("getGlobalLeaderboard", () => {
	it("returns mapped leaderboard entries", async () => {
		selectResults = [
			[
				{
					userId: USER_ID,
					username: "digger1",
					displayName: "Digger One",
					globalRank: 1,
					title: "Crate Digger",
					globalScore: "750",
				},
			],
		];

		const result = await getGlobalLeaderboard(1, 50);
		expect(result).toHaveLength(1);
		expect(result[0].userId).toBe(USER_ID);
		expect(result[0].globalScore).toBe(750);
		expect(typeof result[0].globalScore).toBe("number");
	});

	it("returns empty array when no entries", async () => {
		selectResults = [[]];
		const result = await getGlobalLeaderboard();
		expect(result).toEqual([]);
	});

	it("handles pagination parameters", async () => {
		selectResults = [[]];
		const result = await getGlobalLeaderboard(3, 10);
		expect(result).toEqual([]);
	});
});

describe("getGenreLeaderboard", () => {
	it("returns mapped genre leaderboard from materialized view", async () => {
		executeResult = [
			{
				userId: USER_ID,
				username: "jazzfan",
				displayName: "Jazz Fan",
				globalScore: "500",
				globalRank: "1",
				title: "Wax Prophet",
			},
		];

		const result = await getGenreLeaderboard("Jazz");
		expect(result).toHaveLength(1);
		expect(result[0].userId).toBe(USER_ID);
		expect(result[0].globalScore).toBe(500);
		expect(result[0].globalRank).toBe(1);
	});

	it("returns empty array when no genre entries", async () => {
		executeResult = [];
		const result = await getGenreLeaderboard("Classical");
		expect(result).toEqual([]);
	});

	it("handles null fields gracefully", async () => {
		executeResult = [
			{
				userId: USER_ID,
				username: null,
				displayName: null,
				globalScore: null,
				globalRank: null,
				title: null,
			},
		];

		const result = await getGenreLeaderboard("Funk");
		expect(result[0].username).toBeNull();
		expect(result[0].displayName).toBeNull();
		expect(result[0].globalScore).toBe(0);
		expect(result[0].globalRank).toBeNull();
		expect(result[0].title).toBeNull();
	});
});

describe("getUserRanking", () => {
	it("returns user ranking data", async () => {
		selectResults = [
			[
				{
					rarityScore: 120,
					contributionScore: 45,
					globalRank: 5,
					title: "Crate Digger",
				},
			],
		];

		const result = await getUserRanking(USER_ID);
		expect(result).not.toBeNull();
		expect(result!.gemScore).toBe(120);
		expect(result!.contributionScore).toBe(45);
		expect(result!.globalRank).toBe(5);
		expect(result!.title).toBe("Crate Digger");
	});

	it("returns null when user has no ranking", async () => {
		selectResults = [[]];
		const result = await getUserRanking(USER_ID);
		expect(result).toBeNull();
	});
});

describe("getUserBadges", () => {
	it("returns user badges sorted by earned date", async () => {
		selectResults = [
			[
				{
					slug: "first_dig",
					name: "FIRST_DIG",
					description: "Completed your first import",
					earnedAt: new Date("2026-01-01"),
				},
				{
					slug: "century_club",
					name: "CENTURY_CLUB",
					description: "100 records",
					earnedAt: new Date("2026-02-01"),
				},
			],
		];

		const result = await getUserBadges(USER_ID);
		expect(result).toHaveLength(2);
		expect(result[0].slug).toBe("first_dig");
		expect(result[1].slug).toBe("century_club");
	});

	it("returns empty array when user has no badges", async () => {
		selectResults = [[]];
		const result = await getUserBadges(USER_ID);
		expect(result).toEqual([]);
	});
});

describe("getLeaderboardCount", () => {
	it("returns total count of ranked users", async () => {
		selectResults = [[{ count: "42" }]];
		const result = await getLeaderboardCount();
		expect(result).toBe(42);
	});

	it("returns 0 when no ranked users", async () => {
		selectResults = [[{ count: "0" }]];
		const result = await getLeaderboardCount();
		expect(result).toBe(0);
	});

	it("returns 0 when result is empty", async () => {
		selectResults = [[]];
		const result = await getLeaderboardCount();
		expect(result).toBe(0);
	});
});

describe("getGenreLeaderboardCount", () => {
	it("returns count from materialized view", async () => {
		executeResult = [{ count: "15" }];
		const result = await getGenreLeaderboardCount("Jazz");
		expect(result).toBe(15);
	});

	it("returns 0 when genre has no entries", async () => {
		executeResult = [{ count: "0" }];
		const result = await getGenreLeaderboardCount("Polka");
		expect(result).toBe(0);
	});
});
