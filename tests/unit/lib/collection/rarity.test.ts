import { describe, test, expect } from "vitest";
import {
	getRarityTier,
	getRarityBadgeVariant,
	type RarityTier,
} from "@/lib/collection/rarity";

describe("getRarityTier", () => {
	test("returns 'Ultra Rare' for score >= 2.0", () => {
		expect(getRarityTier(2.0)).toBe("Ultra Rare");
		expect(getRarityTier(5.5)).toBe("Ultra Rare");
		expect(getRarityTier(100)).toBe("Ultra Rare");
	});

	test("returns 'Rare' for score >= 0.5 and < 2.0", () => {
		expect(getRarityTier(0.5)).toBe("Rare");
		expect(getRarityTier(1.0)).toBe("Rare");
		expect(getRarityTier(1.99)).toBe("Rare");
	});

	test("returns 'Common' for score < 0.5", () => {
		expect(getRarityTier(0.0)).toBe("Common");
		expect(getRarityTier(0.1)).toBe("Common");
		expect(getRarityTier(0.49)).toBe("Common");
	});

	test("returns null for null score", () => {
		expect(getRarityTier(null)).toBeNull();
	});

	test("returns null for undefined score", () => {
		expect(getRarityTier(undefined as unknown as null)).toBeNull();
	});

	test("boundary: exactly 0.5 is Rare (not Common)", () => {
		expect(getRarityTier(0.5)).toBe("Rare");
	});

	test("boundary: exactly 2.0 is Ultra Rare (not Rare)", () => {
		expect(getRarityTier(2.0)).toBe("Ultra Rare");
	});
});

describe("getRarityBadgeVariant", () => {
	test("returns 'destructive' for Ultra Rare", () => {
		expect(getRarityBadgeVariant("Ultra Rare")).toBe("destructive");
	});

	test("returns 'default' for Rare", () => {
		expect(getRarityBadgeVariant("Rare")).toBe("default");
	});

	test("returns 'secondary' for Common", () => {
		expect(getRarityBadgeVariant("Common")).toBe("secondary");
	});

	test("returns 'outline' for null", () => {
		expect(getRarityBadgeVariant(null)).toBe("outline");
	});

	test("maps all tiers to distinct variants", () => {
		const tiers: RarityTier[] = ["Ultra Rare", "Rare", "Common", null];
		const variants = tiers.map(getRarityBadgeVariant);
		// All variants should be unique
		expect(new Set(variants).size).toBe(4);
	});
});
