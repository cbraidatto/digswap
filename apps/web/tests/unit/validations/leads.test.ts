import { describe, expect, it } from "vitest";
import { getLeadSchema, getLeadsFilterSchema, saveLeadSchema } from "@/lib/validations/leads";

describe("saveLeadSchema", () => {
	it("accepts valid lead", () => {
		const r = saveLeadSchema.safeParse({
			targetType: "release",
			targetId: "abc123",
			note: null,
			status: "watching",
		});
		expect(r.success).toBe(true);
	});

	it("accepts all valid targetTypes", () => {
		for (const t of ["release", "user", "radar_match"]) {
			expect(
				saveLeadSchema.safeParse({ targetType: t, targetId: "x", note: null, status: "watching" })
					.success,
			).toBe(true);
		}
	});

	it("accepts all valid statuses", () => {
		for (const s of ["watching", "contacted", "dead_end", "found"]) {
			expect(
				saveLeadSchema.safeParse({ targetType: "release", targetId: "x", note: null, status: s })
					.success,
			).toBe(true);
		}
	});

	it("rejects invalid targetType", () => {
		expect(
			saveLeadSchema.safeParse({ targetType: "invalid", targetId: "x", status: "watching" })
				.success,
		).toBe(false);
	});

	it("accepts optional note", () => {
		const r = saveLeadSchema.safeParse({
			targetType: "release",
			targetId: "x",
			status: "watching",
			note: "Found on Discogs",
		});
		expect(r.success).toBe(true);
	});

	it("rejects note over 1000 chars", () => {
		expect(
			saveLeadSchema.safeParse({
				targetType: "release",
				targetId: "x",
				status: "watching",
				note: "a".repeat(1001),
			}).success,
		).toBe(false);
	});
});

describe("getLeadSchema", () => {
	it("accepts valid targetType + targetId", () => {
		expect(getLeadSchema.safeParse({ targetType: "user", targetId: "abc" }).success).toBe(true);
	});
});

describe("getLeadsFilterSchema", () => {
	it("accepts empty object (all optional)", () => {
		expect(getLeadsFilterSchema.safeParse({}).success).toBe(true);
	});

	it("accepts status filter", () => {
		expect(getLeadsFilterSchema.safeParse({ status: "watching" }).success).toBe(true);
	});

	it("accepts targetType filter", () => {
		expect(getLeadsFilterSchema.safeParse({ targetType: "release" }).success).toBe(true);
	});
});
