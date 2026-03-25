import { describe, test } from "vitest";

describe("getDecadeRange", () => {
	test.todo("returns {start: 1980, end: 1990} for '80s'");
	test.todo("returns null for invalid decade string");
});

describe("collectionFilterSchema", () => {
	test.todo("provides default sort='rarity' and page=1 when empty");
	test.todo("validates sort enum rejects invalid values");
	test.todo("coerces page string to number");
});
