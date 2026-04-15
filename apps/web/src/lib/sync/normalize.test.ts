import { describe, expect, it } from "vitest";
import { makeAlbumKey, normalizeForDedup } from "./normalize";

describe("normalizeForDedup", () => {
	it('strips leading "The" article', () => {
		expect(normalizeForDedup("The Beatles")).toBe("beatles");
	});

	it('strips leading "A" article', () => {
		expect(normalizeForDedup("A Tribe Called Quest")).toBe("tribe called quest");
	});

	it("collapses multiple spaces and trims", () => {
		expect(normalizeForDedup("  Miles   Davis  ")).toBe("miles davis");
	});

	it("strips punctuation", () => {
		expect(normalizeForDedup("R.E.M.")).toBe("rem");
	});

	it("returns empty string for null", () => {
		expect(normalizeForDedup(null)).toBe("");
	});

	it('strips leading "An" article', () => {
		expect(normalizeForDedup("An Example")).toBe("example");
	});

	it("returns empty string for empty input", () => {
		expect(normalizeForDedup("")).toBe("");
	});

	it("handles mixed case", () => {
		expect(normalizeForDedup("LED ZEPPELIN")).toBe("led zeppelin");
	});
});

describe("makeAlbumKey", () => {
	it("creates normalized artist::album key", () => {
		expect(makeAlbumKey("The Beatles", "Abbey Road")).toBe("beatles::abbey road");
	});

	it("handles null artist", () => {
		expect(makeAlbumKey(null, "Abbey Road")).toBe("::abbey road");
	});

	it("handles null album", () => {
		expect(makeAlbumKey("The Beatles", null)).toBe("beatles::");
	});

	it("handles both null", () => {
		expect(makeAlbumKey(null, null)).toBe("::");
	});
});
