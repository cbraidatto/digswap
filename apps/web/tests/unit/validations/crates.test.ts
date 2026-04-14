import { describe, expect, it } from "vitest";
import {
	createCrateSchema,
	updateCrateSchema,
	addToCrateSchema,
	crateItemIdSchema,
	createSetSchema,
	updateSetTracksSchema,
	crateIdSchema,
	toggleCrateVisibilitySchema,
	setIdSchema,
} from "@/lib/validations/crates";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("createCrateSchema", () => {
	it("accepts valid crate", () => {
		const r = createCrateSchema.safeParse({
			name: "Jazz Trip",
			date: "2026-04-13",
			sessionType: "digging_trip",
		});
		expect(r.success).toBe(true);
	});

	it("rejects empty name", () => {
		expect(
			createCrateSchema.safeParse({ name: "", date: "2026-04-13", sessionType: "digging_trip" }).success,
		).toBe(false);
	});

	it("rejects name over 100 chars", () => {
		expect(
			createCrateSchema.safeParse({ name: "a".repeat(101), date: "2026-04-13", sessionType: "digging_trip" }).success,
		).toBe(false);
	});

	it("rejects invalid sessionType", () => {
		expect(
			createCrateSchema.safeParse({ name: "Test", date: "2026-04-13", sessionType: "invalid" }).success,
		).toBe(false);
	});

	it("accepts all valid sessionTypes", () => {
		for (const t of ["digging_trip", "event_prep", "wish_list", "other"]) {
			expect(createCrateSchema.safeParse({ name: "Test", date: "2026-04-13", sessionType: t }).success).toBe(true);
		}
	});

	it("rejects invalid date format", () => {
		expect(
			createCrateSchema.safeParse({ name: "Test", date: "13-04-2026", sessionType: "other" }).success,
		).toBe(false);
	});
});

describe("updateCrateSchema", () => {
	it("accepts partial update with id", () => {
		const r = updateCrateSchema.safeParse({ id: UUID, name: "New name" });
		expect(r.success).toBe(true);
	});

	it("requires id", () => {
		expect(updateCrateSchema.safeParse({ name: "No id" }).success).toBe(false);
	});
});

describe("addToCrateSchema", () => {
	it("accepts valid crateId + releaseId with nullable fields", () => {
		expect(
			addToCrateSchema.safeParse({
				crateId: UUID,
				releaseId: UUID,
				discogsId: null,
				title: null,
				artist: null,
				coverImageUrl: null,
			}).success,
		).toBe(true);
	});

	it("accepts with discogsId instead of releaseId", () => {
		expect(
			addToCrateSchema.safeParse({
				crateId: UUID,
				releaseId: null,
				discogsId: 12345,
				title: "Kind of Blue",
				artist: "Miles Davis",
				coverImageUrl: null,
			}).success,
		).toBe(true);
	});
});

describe("crateItemIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(crateItemIdSchema.safeParse({ crateItemId: UUID }).success).toBe(true);
	});
});

describe("createSetSchema", () => {
	it("accepts valid set with all required fields", () => {
		expect(
			createSetSchema.safeParse({
				crateId: UUID,
				eventDate: null,
				venueName: null,
				trackOrder: [UUID],
			}).success,
		).toBe(true);
	});

	it("rejects empty trackOrder", () => {
		expect(
			createSetSchema.safeParse({
				crateId: UUID,
				eventDate: null,
				venueName: null,
				trackOrder: [],
			}).success,
		).toBe(false);
	});
});

describe("updateSetTracksSchema", () => {
	it("accepts valid setId + trackOrder", () => {
		expect(
			updateSetTracksSchema.safeParse({ setId: UUID, trackOrder: [UUID] }).success,
		).toBe(true);
	});
});

describe("crateIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(crateIdSchema.safeParse({ crateId: UUID }).success).toBe(true);
	});
});

describe("toggleCrateVisibilitySchema", () => {
	it("accepts valid toggle", () => {
		expect(toggleCrateVisibilitySchema.safeParse({ crateId: UUID, isPublic: true }).success).toBe(true);
	});

	it("rejects missing isPublic", () => {
		expect(toggleCrateVisibilitySchema.safeParse({ crateId: UUID }).success).toBe(false);
	});
});

describe("setIdSchema", () => {
	it("accepts valid UUID", () => {
		expect(setIdSchema.safeParse({ setId: UUID }).success).toBe(true);
	});
});
