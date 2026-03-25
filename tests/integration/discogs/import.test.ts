import { describe, test, expect } from "vitest";
import type {} from "tests/__mocks__/discogs";

describe("Import pipeline integration", () => {
	test.todo("writes releases to database");

	test.todo("creates collection_items linked to releases");

	test.todo("handles concurrent upserts without conflict");
});
