import { describe, expect, it } from "vitest";
import {
	GEM_TIERS,
	computeGemScore,
	getGemInfo,
	getGemTier,
	getGemWeight,
} from "@/lib/gems/constants";

// ---------------------------------------------------------------------------
// Tests — Pure functions, no mocks needed
// ---------------------------------------------------------------------------

describe("getGemTier", () => {
	it("returns null for null input", () => {
		expect(getGemTier(null)).toBeNull();
	});

	it("returns quartz for score < 0.3", () => {
		expect(getGemTier(0)).toBe("quartz");
		expect(getGemTier(0.1)).toBe("quartz");
		expect(getGemTier(0.29)).toBe("quartz");
	});

	it("returns amethyst for 0.3 <= score < 0.8", () => {
		expect(getGemTier(0.3)).toBe("amethyst");
		expect(getGemTier(0.5)).toBe("amethyst");
		expect(getGemTier(0.79)).toBe("amethyst");
	});

	it("returns emerald for 0.8 <= score < 1.5", () => {
		expect(getGemTier(0.8)).toBe("emerald");
		expect(getGemTier(1.0)).toBe("emerald");
		expect(getGemTier(1.49)).toBe("emerald");
	});

	it("returns ruby for 1.5 <= score < 3.0", () => {
		expect(getGemTier(1.5)).toBe("ruby");
		expect(getGemTier(2.0)).toBe("ruby");
		expect(getGemTier(2.99)).toBe("ruby");
	});

	it("returns sapphire for 3.0 <= score < 6.0", () => {
		expect(getGemTier(3.0)).toBe("sapphire");
		expect(getGemTier(4.5)).toBe("sapphire");
		expect(getGemTier(5.99)).toBe("sapphire");
	});

	it("returns diamond for score >= 6.0", () => {
		expect(getGemTier(6.0)).toBe("diamond");
		expect(getGemTier(10.0)).toBe("diamond");
		expect(getGemTier(100.0)).toBe("diamond");
	});

	it("handles exact boundary values", () => {
		expect(getGemTier(0.3)).toBe("amethyst");
		expect(getGemTier(0.8)).toBe("emerald");
		expect(getGemTier(1.5)).toBe("ruby");
		expect(getGemTier(3.0)).toBe("sapphire");
		expect(getGemTier(6.0)).toBe("diamond");
	});
});

describe("getGemWeight", () => {
	it("returns correct weights for each tier", () => {
		expect(getGemWeight("quartz")).toBe(1);
		expect(getGemWeight("amethyst")).toBe(3);
		expect(getGemWeight("emerald")).toBe(8);
		expect(getGemWeight("ruby")).toBe(20);
		expect(getGemWeight("sapphire")).toBe(35);
		expect(getGemWeight("diamond")).toBe(100);
	});

	it("returns 0 for unknown tier", () => {
		// @ts-expect-error testing invalid input
		expect(getGemWeight("unknown")).toBe(0);
	});
});

describe("getGemInfo", () => {
	it("returns full tier config for each tier", () => {
		const quartz = getGemInfo("quartz");
		expect(quartz.key).toBe("quartz");
		expect(quartz.name).toBe("Quartzo");
		expect(quartz.weight).toBe(1);
		expect(quartz.color).toBe("#9CA3AF");

		const diamond = getGemInfo("diamond");
		expect(diamond.key).toBe("diamond");
		expect(diamond.name).toBe("Diamante");
		expect(diamond.weight).toBe(100);
	});
});

describe("computeGemScore", () => {
	it("returns 0 for empty array", () => {
		expect(computeGemScore([])).toBe(0);
	});

	it("sums weights for single score", () => {
		// score 0.1 = quartz = weight 1
		expect(computeGemScore([0.1])).toBe(1);
	});

	it("sums weights for mixed tiers", () => {
		// quartz(1) + amethyst(3) + diamond(100) = 104
		expect(computeGemScore([0.1, 0.5, 10.0])).toBe(104);
	});

	it("handles all tiers in one collection", () => {
		const scores = [0.1, 0.5, 1.0, 2.0, 4.0, 8.0];
		// quartz(1) + amethyst(3) + emerald(8) + ruby(20) + sapphire(35) + diamond(100) = 167
		expect(computeGemScore(scores)).toBe(167);
	});

	it("handles multiple items in same tier", () => {
		// 3 quartz items = 3 * 1 = 3
		expect(computeGemScore([0.1, 0.2, 0.15])).toBe(3);
	});
});

describe("GEM_TIERS constant", () => {
	it("has 6 tiers", () => {
		expect(GEM_TIERS).toHaveLength(6);
	});

	it("tiers are in ascending maxRatio order", () => {
		for (let i = 1; i < GEM_TIERS.length; i++) {
			expect(GEM_TIERS[i].maxRatio).toBeGreaterThan(GEM_TIERS[i - 1].maxRatio);
		}
	});

	it("weights follow exponential curve", () => {
		const weights = GEM_TIERS.map((t) => t.weight);
		expect(weights).toEqual([1, 3, 8, 20, 35, 100]);
	});

	it("last tier has Infinity maxRatio", () => {
		expect(GEM_TIERS[GEM_TIERS.length - 1].maxRatio).toBe(Infinity);
	});
});
