import { describe, expect, it } from "vitest";
import {
	createPostSchema,
	createReviewSchema,
	createGroupSchema,
	groupIdSchema,
	inviteUserSchema,
	inviteTokenSchema,
	groupMemberSchema,
	loadGroupPostsSchema,
	genreFilterSchema,
	releaseIdSchema,
} from "@/lib/validations/community";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createPostSchema", () => {
	it("accepts valid post", () => {
		expect(createPostSchema.safeParse({ groupId: UUID, content: "Hello world" }).success).toBe(true);
	});

	it("rejects empty content", () => {
		expect(createPostSchema.safeParse({ groupId: UUID, content: "" }).success).toBe(false);
	});

	it("rejects content over 5000 chars", () => {
		expect(createPostSchema.safeParse({ groupId: UUID, content: "a".repeat(5001) }).success).toBe(false);
	});

	it("accepts optional releaseId", () => {
		expect(createPostSchema.safeParse({ groupId: UUID, content: "Post", releaseId: UUID }).success).toBe(true);
	});
});

describe("createReviewSchema", () => {
	it("accepts valid review", () => {
		const r = createReviewSchema.safeParse({
			releaseId: UUID,
			rating: 4,
			body: "Great pressing!",
		});
		expect(r.success).toBe(true);
	});

	it("rejects rating below 1", () => {
		expect(createReviewSchema.safeParse({ releaseId: UUID, rating: 0, body: "Bad" }).success).toBe(false);
	});

	it("rejects rating above 5", () => {
		expect(createReviewSchema.safeParse({ releaseId: UUID, rating: 6, body: "Bad" }).success).toBe(false);
	});

	it("rejects empty body", () => {
		expect(createReviewSchema.safeParse({ releaseId: UUID, rating: 3, body: "" }).success).toBe(false);
	});
});

describe("createGroupSchema", () => {
	it("accepts valid group", () => {
		expect(createGroupSchema.safeParse({ name: "Jazz Collectors" }).success).toBe(true);
	});

	it("rejects empty name", () => {
		expect(createGroupSchema.safeParse({ name: "" }).success).toBe(false);
	});

	it("rejects name over 80 chars", () => {
		expect(createGroupSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
	});

	it("defaults visibility to public", () => {
		const r = createGroupSchema.safeParse({ name: "Test" });
		if (r.success) expect(r.data.visibility).toBe("public");
	});

	it("accepts private visibility", () => {
		expect(createGroupSchema.safeParse({ name: "Test", visibility: "private" }).success).toBe(true);
	});

	it("rejects invalid visibility", () => {
		expect(createGroupSchema.safeParse({ name: "Test", visibility: "secret" }).success).toBe(false);
	});
});

describe("groupIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(groupIdSchema.safeParse({ groupId: UUID }).success).toBe(true);
	});

	it("rejects non-UUID", () => {
		expect(groupIdSchema.safeParse({ groupId: "bad" }).success).toBe(false);
	});
});

describe("inviteUserSchema", () => {
	it("accepts valid invite", () => {
		expect(inviteUserSchema.safeParse({ groupId: UUID, username: "user1" }).success).toBe(true);
	});

	it("rejects empty username", () => {
		expect(inviteUserSchema.safeParse({ groupId: UUID, username: "" }).success).toBe(false);
	});
});

describe("inviteTokenSchema", () => {
	it("accepts valid token UUID", () => {
		expect(inviteTokenSchema.safeParse({ token: UUID }).success).toBe(true);
	});
});

describe("groupMemberSchema", () => {
	it("accepts valid groupId + targetUserId", () => {
		expect(groupMemberSchema.safeParse({ groupId: UUID, targetUserId: UUID }).success).toBe(true);
	});
});

describe("loadGroupPostsSchema", () => {
	it("accepts groupId only", () => {
		expect(loadGroupPostsSchema.safeParse({ groupId: UUID }).success).toBe(true);
	});

	it("accepts groupId with cursor", () => {
		expect(loadGroupPostsSchema.safeParse({ groupId: UUID, cursor: UUID }).success).toBe(true);
	});
});

describe("genreFilterSchema", () => {
	it("accepts optional genre filter", () => {
		expect(genreFilterSchema.safeParse({}).success).toBe(true);
	});

	it("rejects genre over 100 chars", () => {
		expect(genreFilterSchema.safeParse({ genreFilter: "a".repeat(101) }).success).toBe(false);
	});
});

describe("releaseIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(releaseIdSchema.safeParse({ releaseId: UUID }).success).toBe(true);
	});
});
