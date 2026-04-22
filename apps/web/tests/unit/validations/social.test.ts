import { describe, expect, it } from "vitest";
import {
	exploreFeedSchema,
	followUserSchema,
	loadMoreFeedSchema,
	searchUsersSchema,
	userIdSchema,
} from "@/lib/validations/social";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("followUserSchema", () => {
	it("accepts valid targetUserId", () => {
		expect(followUserSchema.safeParse({ targetUserId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(followUserSchema.safeParse({ targetUserId: "bad" }).success).toBe(false);
	});
});

describe("loadMoreFeedSchema", () => {
	it("accepts personal mode with cursor", () => {
		expect(loadMoreFeedSchema.safeParse({ cursor: "abc", mode: "personal" }).success).toBe(true);
	});

	it("accepts global mode", () => {
		expect(loadMoreFeedSchema.safeParse({ cursor: null, mode: "global" }).success).toBe(true);
	});

	it("rejects invalid mode", () => {
		expect(loadMoreFeedSchema.safeParse({ cursor: null, mode: "invalid" }).success).toBe(false);
	});
});

describe("userIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(userIdSchema.safeParse({ userId: UUID }).success).toBe(true);
	});
});

describe("searchUsersSchema", () => {
	it("accepts valid query", () => {
		expect(searchUsersSchema.safeParse({ query: "vinyl" }).success).toBe(true);
	});

	it("rejects query under 2 chars", () => {
		expect(searchUsersSchema.safeParse({ query: "a" }).success).toBe(false);
	});

	it("rejects query over 200 chars", () => {
		expect(searchUsersSchema.safeParse({ query: "a".repeat(201) }).success).toBe(false);
	});
});

describe("exploreFeedSchema", () => {
	it("accepts null cursor", () => {
		expect(exploreFeedSchema.safeParse({ cursor: null }).success).toBe(true);
	});

	it("accepts string cursor", () => {
		expect(exploreFeedSchema.safeParse({ cursor: "some-cursor" }).success).toBe(true);
	});
});
