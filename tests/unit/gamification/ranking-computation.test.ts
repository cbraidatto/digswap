import { describe, test, expect } from "vitest";
import {
	getRankTitleFromScore,
	computeGlobalScore,
	CONTRIBUTION_POINTS,
	RANK_TITLES,
	BADGE_DEFINITIONS,
} from "@/lib/gamification/constants";

// ---------------------------------------------------------------------------
// Wave 0 scaffold: Pure function tests -- no mocking needed
// ---------------------------------------------------------------------------

describe("getRankTitleFromScore", () => {
	test("returns 'Vinyl Rookie' for score 0", () => {
		expect(getRankTitleFromScore(0)).toBe("Vinyl Rookie");
	});

	test("returns 'Vinyl Rookie' for score 50", () => {
		expect(getRankTitleFromScore(50)).toBe("Vinyl Rookie");
	});

	test("returns 'Crate Digger' for score 51", () => {
		expect(getRankTitleFromScore(51)).toBe("Crate Digger");
	});

	test("returns 'Crate Digger' for score 200", () => {
		expect(getRankTitleFromScore(200)).toBe("Crate Digger");
	});

	test("returns 'Wax Prophet' for score 201", () => {
		expect(getRankTitleFromScore(201)).toBe("Wax Prophet");
	});

	test("returns 'Wax Prophet' for score 500", () => {
		expect(getRankTitleFromScore(500)).toBe("Wax Prophet");
	});

	test("returns 'Record Archaeologist' for score 501", () => {
		expect(getRankTitleFromScore(501)).toBe("Record Archaeologist");
	});

	test("returns 'Record Archaeologist' for score 9999", () => {
		expect(getRankTitleFromScore(9999)).toBe("Record Archaeologist");
	});
});

describe("CONTRIBUTION_POINTS", () => {
	test("has correct values per D-03", () => {
		expect(CONTRIBUTION_POINTS.review_written).toBe(10);
		expect(CONTRIBUTION_POINTS.group_post).toBe(3);
		expect(CONTRIBUTION_POINTS.trade_completed).toBe(15);
		expect(CONTRIBUTION_POINTS.following_someone).toBe(1);
		expect(CONTRIBUTION_POINTS.receiving_follow).toBe(2);
	});

	test("aggregation: contributionScore = reviews*10 + posts*3 + following*1 + received_follows*2 (GAME-06)", () => {
		// Given: 5 reviews, 10 posts, 20 following, 15 followers
		const reviews = 5;
		const posts = 10;
		const following = 20;
		const followers = 15;

		const expected = 5 * 10 + 10 * 3 + 20 * 1 + 15 * 2; // 50 + 30 + 20 + 30 = 130

		const computed =
			reviews * CONTRIBUTION_POINTS.review_written +
			posts * CONTRIBUTION_POINTS.group_post +
			following * CONTRIBUTION_POINTS.following_someone +
			followers * CONTRIBUTION_POINTS.receiving_follow;

		expect(computed).toBe(expected);
		expect(computed).toBe(130);
	});
});

describe("computeGlobalScore", () => {
	test("globalScore formula: rarityScore * 0.7 + contributionScore * 0.3", () => {
		expect(computeGlobalScore(100, 50)).toBe(100 * 0.7 + 50 * 0.3); // 85
	});

	test("returns 0 for zero scores", () => {
		expect(computeGlobalScore(0, 0)).toBe(0);
	});

	test("returns 30 for rarity=0, contribution=100", () => {
		expect(computeGlobalScore(0, 100)).toBe(30);
	});
});

describe("BADGE_DEFINITIONS", () => {
	test("contains exactly 6 badges", () => {
		expect(BADGE_DEFINITIONS).toHaveLength(6);
	});
});

describe("RANK_TITLES", () => {
	test("has 4 tiers in ascending order", () => {
		expect(RANK_TITLES).toHaveLength(4);
		for (let i = 1; i < RANK_TITLES.length; i++) {
			expect(RANK_TITLES[i].minScore).toBeGreaterThan(
				RANK_TITLES[i - 1].minScore,
			);
		}
	});
});
