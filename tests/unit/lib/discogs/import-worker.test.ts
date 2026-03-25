import { describe, test, expect } from "vitest";
import type {} from "tests/__mocks__/discogs";

describe("Import worker", () => {
	test.todo("processes one page of collection releases");

	test.todo("upserts releases with admin client");

	test.todo("inserts collection_items for user");

	test.todo("updates import job progress");

	test.todo("broadcasts progress via Realtime");

	test.todo("handles wantlist import after collection");

	test.todo("stops at last page and marks completed");
});
