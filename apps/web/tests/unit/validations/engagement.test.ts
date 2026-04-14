import { describe, expect, it } from "vitest";
import {
	feedItemIdSchema,
	feedItemIdsSchema,
	diggerDnaSchema,
	getDiggerDnaSchema,
	logListeningSchema,
} from "@/lib/validations/engagement";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("feedItemIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(feedItemIdSchema.safeParse({ feedItemId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(feedItemIdSchema.safeParse({ feedItemId: "bad" }).success).toBe(false);
	});
});

describe("feedItemIdsSchema", () => {
	it("accepts array of UUIDs", () => {
		expect(feedItemIdsSchema.safeParse({ feedItemIds: [UUID] }).success).toBe(true);
	});

	it("rejects empty array", () => {
		expect(feedItemIdsSchema.safeParse({ feedItemIds: [] }).success).toBe(false);
	});

	it("rejects array over 100 items", () => {
		const ids = Array.from({ length: 101 }, () => UUID);
		expect(feedItemIdsSchema.safeParse({ feedItemIds: ids }).success).toBe(false);
	});
});

describe("diggerDnaSchema", () => {
	it("accepts optional userId", () => {
		expect(diggerDnaSchema.safeParse({}).success).toBe(true);
	});

	it("accepts valid userId", () => {
		expect(diggerDnaSchema.safeParse({ userId: UUID }).success).toBe(true);
	});
});

describe("getDiggerDnaSchema", () => {
	it("requires userId", () => {
		expect(getDiggerDnaSchema.safeParse({}).success).toBe(false);
	});

	it("accepts valid userId", () => {
		expect(getDiggerDnaSchema.safeParse({ userId: UUID }).success).toBe(true);
	});
});

describe("logListeningSchema", () => {
	it("accepts releaseId only", () => {
		expect(logListeningSchema.safeParse({ releaseId: UUID }).success).toBe(true);
	});

	it("accepts with optional caption and rating", () => {
		const r = logListeningSchema.safeParse({
			releaseId: UUID,
			caption: "Great listen",
			rating: 4,
		});
		expect(r.success).toBe(true);
	});

	it("rejects rating below 1", () => {
		expect(logListeningSchema.safeParse({ releaseId: UUID, rating: 0 }).success).toBe(false);
	});

	it("rejects rating above 5", () => {
		expect(logListeningSchema.safeParse({ releaseId: UUID, rating: 6 }).success).toBe(false);
	});

	it("rejects caption over 500 chars", () => {
		expect(logListeningSchema.safeParse({ releaseId: UUID, caption: "a".repeat(501) }).success).toBe(false);
	});
});
