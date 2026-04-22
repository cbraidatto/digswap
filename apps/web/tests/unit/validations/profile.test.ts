import { describe, expect, it } from "vitest";
import {
	coverPositionSchema,
	holyGrailsSchema,
	showcaseSearchSchema,
	showcaseSlotSchema,
	updateProfileSchema,
} from "@/lib/validations/profile";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("updateProfileSchema", () => {
	it("accepts empty object (all optional)", () => {
		expect(updateProfileSchema.safeParse({}).success).toBe(true);
	});

	it("accepts valid displayName", () => {
		expect(updateProfileSchema.safeParse({ displayName: "DJ Vinyl" }).success).toBe(true);
	});

	it("rejects displayName over 100 chars", () => {
		expect(updateProfileSchema.safeParse({ displayName: "a".repeat(101) }).success).toBe(false);
	});

	it("accepts valid bio", () => {
		expect(updateProfileSchema.safeParse({ bio: "Vinyl collector since 1990" }).success).toBe(true);
	});

	it("rejects bio over 500 chars", () => {
		expect(updateProfileSchema.safeParse({ bio: "a".repeat(501) }).success).toBe(false);
	});

	it("accepts HTTPS youtubeUrl", () => {
		expect(updateProfileSchema.safeParse({ youtubeUrl: "https://youtube.com/@user" }).success).toBe(
			true,
		);
	});

	it("accepts HTTPS websiteUrl", () => {
		expect(updateProfileSchema.safeParse({ websiteUrl: "https://mysite.com" }).success).toBe(true);
	});
});

describe("showcaseSearchSchema", () => {
	it("accepts valid term", () => {
		expect(showcaseSearchSchema.safeParse({ term: "Miles Davis" }).success).toBe(true);
	});

	it("rejects empty term", () => {
		expect(showcaseSearchSchema.safeParse({ term: "" }).success).toBe(false);
	});

	it("rejects term over 200 chars", () => {
		expect(showcaseSearchSchema.safeParse({ term: "a".repeat(201) }).success).toBe(false);
	});
});

describe("showcaseSlotSchema", () => {
	it("accepts valid slot with releaseId", () => {
		expect(showcaseSlotSchema.safeParse({ slot: "favorite", releaseId: UUID }).success).toBe(true);
	});

	it("accepts null releaseId (clearing slot)", () => {
		expect(showcaseSlotSchema.safeParse({ slot: "rarest", releaseId: null }).success).toBe(true);
	});

	it("accepts all valid slots", () => {
		for (const s of ["searching", "rarest", "favorite"]) {
			expect(showcaseSlotSchema.safeParse({ slot: s, releaseId: UUID }).success).toBe(true);
		}
	});

	it("rejects invalid slot", () => {
		expect(showcaseSlotSchema.safeParse({ slot: "invalid", releaseId: UUID }).success).toBe(false);
	});
});

describe("holyGrailsSchema", () => {
	it("accepts array of up to 3 UUIDs", () => {
		expect(holyGrailsSchema.safeParse({ ids: [UUID, UUID, UUID] }).success).toBe(true);
	});

	it("accepts empty array", () => {
		expect(holyGrailsSchema.safeParse({ ids: [] }).success).toBe(true);
	});

	it("rejects more than 3 items", () => {
		expect(holyGrailsSchema.safeParse({ ids: [UUID, UUID, UUID, UUID] }).success).toBe(false);
	});
});

describe("coverPositionSchema", () => {
	it("accepts positionY in range", () => {
		expect(coverPositionSchema.safeParse({ positionY: 50 }).success).toBe(true);
	});

	it("accepts positionY 0", () => {
		expect(coverPositionSchema.safeParse({ positionY: 0 }).success).toBe(true);
	});

	it("accepts positionY 100", () => {
		expect(coverPositionSchema.safeParse({ positionY: 100 }).success).toBe(true);
	});

	it("rejects positionY below 0", () => {
		expect(coverPositionSchema.safeParse({ positionY: -1 }).success).toBe(false);
	});

	it("rejects positionY above 100", () => {
		expect(coverPositionSchema.safeParse({ positionY: 101 }).success).toBe(false);
	});
});
