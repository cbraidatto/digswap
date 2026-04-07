import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/community/slugify";

describe("slugify", () => {
	it("lowercases a single word", () => {
		expect(slugify("Electronic")).toBe("electronic");
	});

	it("replaces spaces with hyphens", () => {
		expect(slugify("Hip Hop")).toBe("hip-hop");
	});

	it("strips special characters and punctuation", () => {
		expect(slugify("Folk, World, & Country")).toBe("folk-world-country");
	});

	it("trims leading/trailing whitespace", () => {
		expect(slugify("  Blue Note Originals SP  ")).toBe("blue-note-originals-sp");
	});

	it("removes all non-alphanumeric except hyphens", () => {
		expect(slugify("Test!!!Group@#$")).toBe("testgroup");
	});

	it("returns empty string for empty input", () => {
		expect(slugify("")).toBe("");
	});

	it("collapses multiple consecutive hyphens", () => {
		expect(slugify("---multiple---hyphens---")).toBe("multiple-hyphens");
	});
});
