import { describe, test, expect } from "vitest";
import type {} from "tests/__mocks__/discogs";

describe("Delta sync", () => {
	test.todo("fetches collection sorted by date_added desc");

	test.todo("stops when encountering items older than lastSyncedAt");

	test.todo("updates lastSyncedAt on profile after sync");
});
