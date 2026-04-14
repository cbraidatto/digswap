import { describe, expect, it } from "vitest";
import { releaseIdSchema, getMoreReviewsSchema } from "@/lib/validations/release";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("releaseIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(releaseIdSchema.safeParse({ releaseInternalId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(releaseIdSchema.safeParse({ releaseInternalId: "bad" }).success).toBe(false);
	});
});

describe("getMoreReviewsSchema", () => {
	it("accepts valid input", () => {
		const r = getMoreReviewsSchema.safeParse({
			releaseId: UUID,
			cursor: "abc123",
			limit: 10,
		});
		expect(r.success).toBe(true);
	});

	it("defaults limit to 10", () => {
		const r = getMoreReviewsSchema.safeParse({ releaseId: UUID, cursor: "abc" });
		expect(r.success).toBe(true);
		if (r.success) expect(r.data.limit).toBe(10);
	});

	it("rejects limit above 50", () => {
		expect(
			getMoreReviewsSchema.safeParse({ releaseId: UUID, cursor: "abc", limit: 51 }).success,
		).toBe(false);
	});

	it("rejects limit below 1", () => {
		expect(
			getMoreReviewsSchema.safeParse({ releaseId: UUID, cursor: "abc", limit: 0 }).success,
		).toBe(false);
	});
});
