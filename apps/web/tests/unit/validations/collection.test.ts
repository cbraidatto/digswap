import { describe, expect, it } from "vitest";
import {
	addRecordSchema,
	searchDiscogsSchema,
	updateConditionSchema,
} from "@/lib/validations/collection";

describe("searchDiscogsSchema", () => {
	it("accepts valid query", () => {
		expect(searchDiscogsSchema.safeParse({ query: "Miles Davis" }).success).toBe(true);
	});

	it("rejects query over 200 chars", () => {
		expect(searchDiscogsSchema.safeParse({ query: "a".repeat(201) }).success).toBe(false);
	});

	it("accepts empty query (no min constraint)", () => {
		expect(searchDiscogsSchema.safeParse({ query: "" }).success).toBe(true);
	});
});

describe("addRecordSchema", () => {
	it("accepts positive discogsId", () => {
		expect(addRecordSchema.safeParse({ discogsId: 12345 }).success).toBe(true);
	});

	it("rejects zero discogsId", () => {
		expect(addRecordSchema.safeParse({ discogsId: 0 }).success).toBe(false);
	});

	it("rejects negative discogsId", () => {
		expect(addRecordSchema.safeParse({ discogsId: -1 }).success).toBe(false);
	});
});

describe("updateConditionSchema", () => {
	it("accepts valid UUID collectionItemId", () => {
		const r = updateConditionSchema.safeParse({
			collectionItemId: "550e8400-e29b-41d4-a716-446655440000",
		});
		expect(r.success).toBe(true);
	});

	it("rejects non-UUID collectionItemId", () => {
		expect(updateConditionSchema.safeParse({ collectionItemId: "bad" }).success).toBe(false);
	});
});
