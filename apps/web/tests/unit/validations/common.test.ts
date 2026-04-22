import { describe, expect, it } from "vitest";
import {
	paginationSchema,
	sanitizeWildcards,
	urlSchema,
	uuidSchema,
} from "@/lib/validations/common";

describe("uuidSchema", () => {
	it("accepts valid UUID", () => {
		const r = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
		expect(r.success).toBe(true);
	});

	it("rejects non-UUID string", () => {
		expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
	});

	it("rejects empty string", () => {
		expect(uuidSchema.safeParse("").success).toBe(false);
	});
});

describe("paginationSchema", () => {
	it("defaults page to 1 when omitted", () => {
		const r = paginationSchema.safeParse({});
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.page).toBe(1);
	});

	it("accepts page within range", () => {
		expect(paginationSchema.safeParse({ page: 500 }).success).toBe(true);
	});

	it("rejects page 0", () => {
		expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
	});

	it("rejects page above 1000", () => {
		expect(paginationSchema.safeParse({ page: 1001 }).success).toBe(false);
	});

	it("accepts optional cursor UUID", () => {
		const r = paginationSchema.safeParse({
			cursor: "550e8400-e29b-41d4-a716-446655440000",
		});
		expect(r.success).toBe(true);
	});

	it("rejects invalid cursor", () => {
		expect(paginationSchema.safeParse({ cursor: "bad" }).success).toBe(false);
	});
});

describe("urlSchema", () => {
	it("accepts valid https URL", () => {
		const r = urlSchema.safeParse("https://example.com");
		expect(r.success).toBe(true);
	});

	it("accepts valid http URL", () => {
		expect(urlSchema.safeParse("http://example.com").success).toBe(true);
	});

	it("accepts undefined (optional)", () => {
		expect(urlSchema.safeParse(undefined).success).toBe(true);
	});

	it("rejects non-http protocol", () => {
		expect(urlSchema.safeParse("ftp://example.com").success).toBe(false);
	});

	it("rejects URLs exceeding 500 chars", () => {
		const longUrl = `https://example.com/${"a".repeat(500)}`;
		expect(urlSchema.safeParse(longUrl).success).toBe(false);
	});
});

describe("sanitizeWildcards", () => {
	it("escapes % characters", () => {
		expect(sanitizeWildcards("100%")).toBe("100\\%");
	});

	it("escapes _ characters", () => {
		expect(sanitizeWildcards("hello_world")).toBe("hello\\_world");
	});

	it("returns clean string unchanged", () => {
		expect(sanitizeWildcards("hello")).toBe("hello");
	});
});
