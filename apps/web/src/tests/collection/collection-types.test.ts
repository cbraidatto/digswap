import { describe, expect, it } from "vitest";
import type { CollectionItem } from "@/lib/collection/queries";
import type { CollectionFilters } from "@/lib/collection/filters";

/**
 * Type-level tests to verify CollectionItem includes visibility + quality metadata fields.
 * These tests will fail at compile time if the fields are missing.
 */
describe("CollectionItem type", () => {
	it("includes visibility field", () => {
		const item = {} as CollectionItem;
		// This will fail tsc --noEmit if visibility is not on the type
		const visibility: string = item.visibility;
		expect(typeof visibility).toBe("string");
	});

	it("includes audioFormat field", () => {
		const item = {} as CollectionItem;
		const audioFormat: string | null = item.audioFormat;
		expect(audioFormat).toBeNull();
	});

	it("includes bitrate field", () => {
		const item = {} as CollectionItem;
		const bitrate: number | null = item.bitrate;
		expect(bitrate).toBeNull();
	});

	it("includes sampleRate field", () => {
		const item = {} as CollectionItem;
		const sampleRate: number | null = item.sampleRate;
		expect(sampleRate).toBeNull();
	});

	it("still includes openForTrade for backward compat", () => {
		const item = {} as CollectionItem;
		const openForTrade: number = item.openForTrade;
		expect(typeof openForTrade).toBe("number");
	});
});

describe("CollectionFilters type", () => {
	it("includes optional visibility filter", () => {
		const filters: CollectionFilters = {
			sort: "rarity",
			page: 1,
			visibility: "tradeable",
		};
		expect(filters.visibility).toBe("tradeable");
	});

	it("defaults visibility to all when not specified", () => {
		const filters: CollectionFilters = {
			sort: "rarity",
			page: 1,
		};
		// visibility is optional, should be undefined when not set
		expect(filters.visibility).toBeUndefined();
	});
});
