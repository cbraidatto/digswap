import { describe, test, expect } from "vitest";
import {
	getDecadeRange,
	collectionFilterSchema,
	DECADES,
	CONDITION_GRADES,
	SORT_OPTIONS,
} from "@/lib/collection/filters";

describe("getDecadeRange", () => {
	test("returns {start: 1980, end: 1990} for '80s'", () => {
		expect(getDecadeRange("80s")).toEqual({ start: 1980, end: 1990 });
	});

	test("returns {start: 1950, end: 1960} for '50s'", () => {
		expect(getDecadeRange("50s")).toEqual({ start: 1950, end: 1960 });
	});

	test("returns {start: 2020, end: 2030} for '20s'", () => {
		expect(getDecadeRange("20s")).toEqual({ start: 2020, end: 2030 });
	});

	test("returns null for invalid decade string", () => {
		expect(getDecadeRange("invalid")).toBeNull();
		expect(getDecadeRange("30s")).toBeNull();
		expect(getDecadeRange("")).toBeNull();
	});

	test("covers all defined decades", () => {
		for (const d of DECADES) {
			const range = getDecadeRange(d.label);
			expect(range).not.toBeNull();
			expect(range!.start).toBe(d.startYear);
			expect(range!.end).toBe(d.startYear + 10);
		}
	});
});

describe("collectionFilterSchema", () => {
	test("provides default sort='rarity' and page=1 when empty", () => {
		const result = collectionFilterSchema.parse({});
		expect(result.sort).toBe("rarity");
		expect(result.page).toBe(1);
	});

	test("validates sort enum rejects invalid values", () => {
		expect(() => collectionFilterSchema.parse({ sort: "invalid" })).toThrow();
	});

	test("accepts all valid sort options", () => {
		for (const opt of SORT_OPTIONS) {
			const result = collectionFilterSchema.parse({ sort: opt.value });
			expect(result.sort).toBe(opt.value);
		}
	});

	test("coerces page string to number", () => {
		const result = collectionFilterSchema.parse({ page: "3" });
		expect(result.page).toBe(3);
	});

	test("rejects page < 1", () => {
		expect(() => collectionFilterSchema.parse({ page: "0" })).toThrow();
		expect(() => collectionFilterSchema.parse({ page: "-1" })).toThrow();
	});

	test("passes through genre, decade, format as optional strings", () => {
		const result = collectionFilterSchema.parse({
			genre: "Jazz",
			decade: "80s",
			format: "LP",
		});
		expect(result.genre).toBe("Jazz");
		expect(result.decade).toBe("80s");
		expect(result.format).toBe("LP");
	});

	test("allows omitting optional fields", () => {
		const result = collectionFilterSchema.parse({});
		expect(result.genre).toBeUndefined();
		expect(result.decade).toBeUndefined();
		expect(result.format).toBeUndefined();
	});
});

describe("CONDITION_GRADES", () => {
	test("contains exactly 7 grades in Discogs order", () => {
		expect(CONDITION_GRADES).toEqual(["Mint", "VG+", "VG", "G+", "G", "F", "P"]);
	});

	test("has correct length", () => {
		expect(CONDITION_GRADES).toHaveLength(7);
	});
});

describe("SORT_OPTIONS", () => {
	test("contains rarity, date, alpha options", () => {
		const values = SORT_OPTIONS.map((o) => o.value);
		expect(values).toContain("rarity");
		expect(values).toContain("date");
		expect(values).toContain("alpha");
	});
});
