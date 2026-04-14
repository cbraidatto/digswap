import { describe, expect, it } from "vitest";
import { searchRecordsSchema, browseRecordsSchema } from "@/lib/validations/discovery";

describe("searchRecordsSchema", () => {
	it("accepts valid search term", () => {
		expect(searchRecordsSchema.safeParse({ term: "Jazz" }).success).toBe(true);
	});

	it("rejects term under 2 chars", () => {
		expect(searchRecordsSchema.safeParse({ term: "a" }).success).toBe(false);
	});

	it("rejects term over 200 chars", () => {
		expect(searchRecordsSchema.safeParse({ term: "a".repeat(201) }).success).toBe(false);
	});
});

describe("browseRecordsSchema", () => {
	it("accepts with nullable fields set to null", () => {
		expect(
			browseRecordsSchema.safeParse({ genre: null, decade: null }).success,
		).toBe(true);
	});

	it("accepts genre + decade filters", () => {
		expect(browseRecordsSchema.safeParse({ genre: "Jazz", decade: "1960s" }).success).toBe(true);
	});

	it("accepts page number with nullable fields", () => {
		expect(
			browseRecordsSchema.safeParse({ genre: null, decade: null, page: 5 }).success,
		).toBe(true);
	});

	it("accepts genres array", () => {
		expect(
			browseRecordsSchema.safeParse({ genre: null, decade: null, genres: ["Jazz", "Soul"] }).success,
		).toBe(true);
	});
});
