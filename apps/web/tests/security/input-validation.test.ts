import { describe, expect, it } from "vitest";
import { sanitizeWildcards, urlSchema, uuidSchema } from "@/lib/validations/common";
import { createPostSchema, createReviewSchema } from "@/lib/validations/community";
import { showcaseSearchSchema, updateProfileSchema } from "@/lib/validations/profile";

describe("Input Validation", () => {
	// -------------------------------------------------------------------
	// UUID Schema
	// -------------------------------------------------------------------
	describe("uuidSchema", () => {
		it("accepts a valid UUID", () => {
			const result = uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000");
			expect(result.success).toBe(true);
		});

		it("rejects a non-UUID string", () => {
			const result = uuidSchema.safeParse("not-a-uuid");
			expect(result.success).toBe(false);
		});

		it("rejects an empty string", () => {
			const result = uuidSchema.safeParse("");
			expect(result.success).toBe(false);
		});

		it("rejects a number", () => {
			const result = uuidSchema.safeParse(12345);
			expect(result.success).toBe(false);
		});
	});

	// -------------------------------------------------------------------
	// sanitizeWildcards
	// -------------------------------------------------------------------
	describe("sanitizeWildcards", () => {
		it("escapes % character", () => {
			expect(sanitizeWildcards("test%value")).toBe("test\\%value");
		});

		it("escapes _ character", () => {
			expect(sanitizeWildcards("test_value")).toBe("test\\_value");
		});

		it("escapes \\ character", () => {
			expect(sanitizeWildcards("test\\value")).toBe("test\\\\value");
		});

		it("escapes multiple special characters", () => {
			expect(sanitizeWildcards("%_\\")).toBe("\\%\\_\\\\");
		});

		it("returns plain text unchanged", () => {
			expect(sanitizeWildcards("hello world")).toBe("hello world");
		});
	});

	// -------------------------------------------------------------------
	// urlSchema
	// -------------------------------------------------------------------
	describe("urlSchema", () => {
		it("accepts a valid URL", () => {
			const result = urlSchema.safeParse("https://example.com");
			expect(result.success).toBe(true);
		});

		it("accepts an empty string (optional)", () => {
			const result = urlSchema.safeParse("");
			expect(result.success).toBe(true);
		});

		it("accepts undefined (optional)", () => {
			const result = urlSchema.safeParse(undefined);
			expect(result.success).toBe(true);
		});

		it("rejects a malformed string", () => {
			const result = urlSchema.safeParse("not a url");
			expect(result.success).toBe(false);
		});

		it("rejects a string exceeding 500 chars", () => {
			const longUrl = `https://example.com/${"a".repeat(500)}`;
			const result = urlSchema.safeParse(longUrl);
			expect(result.success).toBe(false);
		});
	});

	// -------------------------------------------------------------------
	// createPostSchema
	// -------------------------------------------------------------------
	describe("createPostSchema", () => {
		it("accepts valid post data", () => {
			const result = createPostSchema.safeParse({
				groupId: "550e8400-e29b-41d4-a716-446655440000",
				content: "This is a valid post about vinyl!",
			});
			expect(result.success).toBe(true);
		});

		it("rejects empty content", () => {
			const result = createPostSchema.safeParse({
				groupId: "550e8400-e29b-41d4-a716-446655440000",
				content: "",
			});
			expect(result.success).toBe(false);
		});

		it("rejects content exceeding 5000 chars", () => {
			const result = createPostSchema.safeParse({
				groupId: "550e8400-e29b-41d4-a716-446655440000",
				content: "x".repeat(5001),
			});
			expect(result.success).toBe(false);
		});

		it("rejects missing groupId", () => {
			const result = createPostSchema.safeParse({
				content: "Some post content",
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid groupId (non-UUID)", () => {
			const result = createPostSchema.safeParse({
				groupId: "invalid",
				content: "Some post content",
			});
			expect(result.success).toBe(false);
		});

		it("accepts optional releaseId as UUID", () => {
			const result = createPostSchema.safeParse({
				groupId: "550e8400-e29b-41d4-a716-446655440000",
				content: "Post with release",
				releaseId: "660e8400-e29b-41d4-a716-446655440000",
			});
			expect(result.success).toBe(true);
		});
	});

	// -------------------------------------------------------------------
	// createReviewSchema
	// -------------------------------------------------------------------
	describe("createReviewSchema", () => {
		const validReview = {
			releaseId: "550e8400-e29b-41d4-a716-446655440000",
			rating: 4,
			body: "Great pressing quality, warm tone throughout.",
		};

		it("accepts a valid review", () => {
			const result = createReviewSchema.safeParse(validReview);
			expect(result.success).toBe(true);
		});

		it("rejects rating below 1", () => {
			const result = createReviewSchema.safeParse({ ...validReview, rating: 0 });
			expect(result.success).toBe(false);
		});

		it("rejects rating above 5", () => {
			const result = createReviewSchema.safeParse({ ...validReview, rating: 6 });
			expect(result.success).toBe(false);
		});

		it("rejects non-integer rating", () => {
			const result = createReviewSchema.safeParse({ ...validReview, rating: 3.5 });
			expect(result.success).toBe(false);
		});

		it("rejects missing body", () => {
			const result = createReviewSchema.safeParse({
				releaseId: "550e8400-e29b-41d4-a716-446655440000",
				rating: 4,
			});
			expect(result.success).toBe(false);
		});

		it("rejects empty body", () => {
			const result = createReviewSchema.safeParse({ ...validReview, body: "" });
			expect(result.success).toBe(false);
		});

		it("rejects body exceeding 5000 chars", () => {
			const result = createReviewSchema.safeParse({
				...validReview,
				body: "x".repeat(5001),
			});
			expect(result.success).toBe(false);
		});
	});

	// -------------------------------------------------------------------
	// updateProfileSchema
	// -------------------------------------------------------------------
	describe("updateProfileSchema", () => {
		it("accepts valid profile update", () => {
			const result = updateProfileSchema.safeParse({
				displayName: "DJ Vinyl",
				bio: "Collecting since 2005",
				youtubeUrl: "https://youtube.com/@djvinyl",
				websiteUrl: "https://djvinyl.com",
			});
			expect(result.success).toBe(true);
		});

		it("rejects invalid YouTube URL", () => {
			const result = updateProfileSchema.safeParse({
				displayName: "DJ Vinyl",
				youtubeUrl: "not-a-url",
			});
			expect(result.success).toBe(false);
		});

		it("rejects invalid website URL", () => {
			const result = updateProfileSchema.safeParse({
				displayName: "DJ Vinyl",
				websiteUrl: "not-a-url",
			});
			expect(result.success).toBe(false);
		});

		it("accepts empty URL strings (optional fields)", () => {
			const result = updateProfileSchema.safeParse({
				displayName: "DJ Vinyl",
				youtubeUrl: "",
				websiteUrl: "",
			});
			expect(result.success).toBe(true);
		});

		it("accepts all fields as optional", () => {
			const result = updateProfileSchema.safeParse({});
			expect(result.success).toBe(true);
		});
	});

	// -------------------------------------------------------------------
	// showcaseSearchSchema
	// -------------------------------------------------------------------
	describe("showcaseSearchSchema", () => {
		it("accepts valid search term", () => {
			const result = showcaseSearchSchema.safeParse({ term: "Miles Davis" });
			expect(result.success).toBe(true);
		});

		it("rejects empty search term", () => {
			const result = showcaseSearchSchema.safeParse({ term: "" });
			expect(result.success).toBe(false);
		});

		it("rejects search term exceeding 200 chars", () => {
			const result = showcaseSearchSchema.safeParse({ term: "x".repeat(201) });
			expect(result.success).toBe(false);
		});
	});
});
