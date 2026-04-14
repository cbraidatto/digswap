import { describe, expect, it } from "vitest";
import {
	BADGE_DEFINITIONS,
	CONTRIBUTION_POINTS,
	RANK_TITLES,
	computeGlobalScore,
	getRankTitleFromScore,
} from "@/lib/gamification/constants";

// ---------------------------------------------------------------------------
// Tests — Pure functions, no mocks needed
// ---------------------------------------------------------------------------

describe("computeGlobalScore", () => {
	it("computes weighted score: gemScore * 0.7 + contributionScore * 0.3", () => {
		expect(computeGlobalScore(100, 100)).toBe(100);
		expect(computeGlobalScore(1000, 0)).toBe(700);
		expect(computeGlobalScore(0, 1000)).toBe(300);
	});

	it("handles zero inputs", () => {
		expect(computeGlobalScore(0, 0)).toBe(0);
	});

	it("returns correct precision for fractional inputs", () => {
		const result = computeGlobalScore(10, 10);
		expect(result).toBeCloseTo(10, 5);
	});

	it("handles large values", () => {
		const result = computeGlobalScore(50000, 10000);
		expect(result).toBe(50000 * 0.7 + 10000 * 0.3);
	});
});

describe("getRankTitleFromScore", () => {
	it("returns Vinyl Rookie for score 0", () => {
		expect(getRankTitleFromScore(0)).toBe("Vinyl Rookie");
	});

	it("returns Vinyl Rookie for score 500", () => {
		expect(getRankTitleFromScore(500)).toBe("Vinyl Rookie");
	});

	it("returns Crate Digger for score 501", () => {
		expect(getRankTitleFromScore(501)).toBe("Crate Digger");
	});

	it("returns Crate Digger for score 2000", () => {
		expect(getRankTitleFromScore(2000)).toBe("Crate Digger");
	});

	it("returns Wax Prophet for score 2001", () => {
		expect(getRankTitleFromScore(2001)).toBe("Wax Prophet");
	});

	it("returns Record Archaeologist for score 5001", () => {
		expect(getRankTitleFromScore(5001)).toBe("Record Archaeologist");
	});

	it("returns Record Archaeologist for very high scores", () => {
		expect(getRankTitleFromScore(999999)).toBe("Record Archaeologist");
	});

	it("returns Vinyl Rookie for negative scores", () => {
		expect(getRankTitleFromScore(-10)).toBe("Vinyl Rookie");
	});
});

describe("RANK_TITLES", () => {
	it("has 4 tiers in ascending order", () => {
		expect(RANK_TITLES).toHaveLength(4);
		for (let i = 1; i < RANK_TITLES.length; i++) {
			expect(RANK_TITLES[i].minScore).toBeGreaterThan(RANK_TITLES[i - 1].minScore);
		}
	});

	it("starts at minScore 0", () => {
		expect(RANK_TITLES[0].minScore).toBe(0);
	});
});

describe("CONTRIBUTION_POINTS", () => {
	it("has expected point values", () => {
		expect(CONTRIBUTION_POINTS.review_written).toBe(10);
		expect(CONTRIBUTION_POINTS.trade_completed).toBe(15);
		expect(CONTRIBUTION_POINTS.group_post).toBe(3);
		expect(CONTRIBUTION_POINTS.following_someone).toBe(1);
		expect(CONTRIBUTION_POINTS.receiving_follow).toBe(2);
	});

	it("trade_completed is the highest value action", () => {
		const values = Object.values(CONTRIBUTION_POINTS);
		expect(CONTRIBUTION_POINTS.trade_completed).toBe(Math.max(...values));
	});
});

describe("BADGE_DEFINITIONS", () => {
	it("has 6 badges", () => {
		expect(BADGE_DEFINITIONS).toHaveLength(6);
	});

	it("each badge has slug, name, and description", () => {
		for (const badge of BADGE_DEFINITIONS) {
			expect(badge.slug).toBeTruthy();
			expect(badge.name).toBeTruthy();
			expect(badge.description).toBeTruthy();
		}
	});

	it("has unique slugs", () => {
		const slugs = BADGE_DEFINITIONS.map((b) => b.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});

	it("includes expected badges", () => {
		const slugs = BADGE_DEFINITIONS.map((b) => b.slug);
		expect(slugs).toContain("first_dig");
		expect(slugs).toContain("century_club");
		expect(slugs).toContain("rare_find");
		expect(slugs).toContain("critic");
		expect(slugs).toContain("connector");
		expect(slugs).toContain("crew_member");
	});
});
