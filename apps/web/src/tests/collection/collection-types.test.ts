import { describe, expect, it } from "vitest";
import type { CollectionFilters } from "@/lib/collection/filters";
import { collectionFilterSchema, VISIBILITY_OPTIONS } from "@/lib/collection/filters";
import type { CollectionItem } from "@/lib/collection/queries";

/**
 * Type-level + runtime tests for visibility and quality metadata on CollectionItem.
 * Type assertions compile-check field presence; runtime assertions validate schema behavior.
 */
describe("CollectionItem type", () => {
	// Use a fully-populated mock to verify type assignments at compile time
	const mockItem: CollectionItem = {
		id: "test-id",
		conditionGrade: null,
		addedVia: "manual",
		createdAt: new Date(),
		releaseId: "rel-id",
		discogsId: 12345,
		title: "Test Record",
		artist: "Test Artist",
		year: 2020,
		genre: ["Rock"],
		format: "LP",
		coverImageUrl: null,
		rarityScore: 1.5,
		youtubeVideoId: null,
		notes: null,
		openForTrade: 1,
		personalRating: null,
		tracklist: null,
		visibility: "tradeable",
		audioFormat: "FLAC",
		bitrate: 1411,
		sampleRate: 44100,
	};

	it("includes visibility field", () => {
		expect(mockItem.visibility).toBe("tradeable");
	});

	it("includes audioFormat field", () => {
		expect(mockItem.audioFormat).toBe("FLAC");
	});

	it("includes bitrate field", () => {
		expect(mockItem.bitrate).toBe(1411);
	});

	it("includes sampleRate field", () => {
		expect(mockItem.sampleRate).toBe(44100);
	});

	it("still includes openForTrade for backward compat", () => {
		expect(mockItem.openForTrade).toBe(1);
	});
});

describe("CollectionFilters visibility", () => {
	it("accepts valid visibility filter values", () => {
		const result = collectionFilterSchema.parse({
			sort: "rarity",
			page: 1,
			visibility: "tradeable",
		});
		expect(result.visibility).toBe("tradeable");
	});

	it("accepts all as visibility filter", () => {
		const result = collectionFilterSchema.parse({
			sort: "rarity",
			page: 1,
			visibility: "all",
		});
		expect(result.visibility).toBe("all");
	});

	it("visibility is optional", () => {
		const result = collectionFilterSchema.parse({
			sort: "rarity",
			page: 1,
		});
		expect(result.visibility).toBeUndefined();
	});

	it("rejects invalid visibility values", () => {
		const result = collectionFilterSchema.safeParse({
			sort: "rarity",
			page: 1,
			visibility: "invalid_value",
		});
		expect(result.success).toBe(false);
	});

	it("VISIBILITY_OPTIONS contains expected values", () => {
		expect(VISIBILITY_OPTIONS).toEqual(["tradeable", "not_trading", "private"]);
	});
});
