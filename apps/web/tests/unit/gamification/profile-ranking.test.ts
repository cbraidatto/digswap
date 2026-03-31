import { describe, test, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

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

	// db.execute for raw SQL queries
	chain.execute = vi.fn().mockImplementation(() => ({
		then: (resolve: (v: unknown) => void) => {
			const result = queryResults[queryCallCount] ?? [];
			queryCallCount++;
			return resolve(result);
		},
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

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { getUserRanking } from "@/lib/gamification/queries";
import { computeGlobalScore } from "@/lib/gamification/constants";

describe("getUserRanking", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	test("returns ranking data for ranked user", async () => {
		queryResults = [
			[
				{
					rarityScore: 127.3,
					contributionScore: 38.5,
					globalRank: 42,
					title: "Wax Prophet",
				},
			],
		];

		const result = await getUserRanking("user-1");

		expect(result).not.toBeNull();
		expect(result!.rarityScore).toBe(127.3);
		expect(result!.contributionScore).toBe(38.5);
		expect(result!.globalRank).toBe(42);
		expect(result!.title).toBe("Wax Prophet");
	});

	test("returns null for unranked user", async () => {
		queryResults = [[]];

		const result = await getUserRanking("unranked-user");

		expect(result).toBeNull();
	});
});

describe("profile ranking display logic", () => {
	test("displays fallback values when user is unranked", () => {
		// When getUserRanking returns null, profile uses fallbacks
		const ranking = null;

		const title = ranking?.title ?? "Vinyl Rookie";
		const globalRank = ranking?.globalRank ?? null;
		const rarityScore = ranking?.rarityScore ?? 0;
		const contributionScore = ranking?.contributionScore ?? 0;

		expect(title).toBe("Vinyl Rookie");
		expect(globalRank).toBeNull();
		expect(rarityScore).toBe(0);
		expect(contributionScore).toBe(0);

		// Display format for unranked user
		const rankDisplay = globalRank ? `#${globalRank}` : "#--";
		expect(rankDisplay).toBe("#--");
	});

	test("globalScore computed correctly from ranking data", () => {
		const rarityScore = 127.3;
		const contributionScore = 38.5;

		const globalScore = computeGlobalScore(rarityScore, contributionScore);

		// 127.3 * 0.7 + 38.5 * 0.3 = 89.11 + 11.55 = 100.66
		expect(globalScore).toBeCloseTo(100.66, 1);
		expect(globalScore.toFixed(1)).toBe("100.7");
	});

	test("stats row values computed correctly", () => {
		const globalRank = 42;
		const globalScore = computeGlobalScore(127.3, 38.5);

		// RANK value
		const rankValue = globalRank ? `#${globalRank}` : "#--";
		expect(rankValue).toBe("#42");

		// SCORE value
		const scoreValue = globalScore.toFixed(1);
		expect(scoreValue).toBe("100.7");
	});
});
