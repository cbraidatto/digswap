import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const CRATE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CRATE_ITEM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const SET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RELEASE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const USER_ID = "user-1111-1111-1111-1111";
const OTHER_USER_ID = "user-2222-2222-2222-2222";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/crates/queries", () => ({
	getCrates: vi.fn(async () => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return result;
	}),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	chain.insert = vi.fn().mockImplementation(() => ({
		values: mockInsertValues.mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	chain.update = vi.fn().mockImplementation(() => ({
		set: mockUpdateSet.mockImplementation(() => ({
			where: mockUpdateWhere.mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = selectResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
		})),
	}));

	chain.delete = vi.fn().mockImplementation(() => ({
		where: mockDeleteWhere.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => {
				const result = selectResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/crates", () => ({
	crates: {
		id: "id",
		userId: "user_id",
		name: "name",
		date: "date",
		sessionType: "session_type",
		isPublic: "is_public",
		updatedAt: "updated_at",
	},
	crateItems: {
		id: "id",
		crateId: "crate_id",
		userId: "user_id",
		releaseId: "release_id",
		discogsId: "discogs_id",
		title: "title",
		artist: "artist",
		coverImageUrl: "cover_image_url",
		status: "status",
	},
	sets: {
		id: "id",
		crateId: "crate_id",
		userId: "user_id",
		eventDate: "event_date",
		venueName: "venue_name",
	},
	setTracks: {
		id: "id",
		setId: "set_id",
		crateItemId: "crate_item_id",
		userId: "user_id",
		position: "position",
	},
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		addedVia: "added_via",
	},
}));

vi.mock("@/lib/db/schema/wantlist", () => ({
	wantlistItems: {
		id: "id",
		userId: "user_id",
		releaseId: "release_id",
		addedVia: "added_via",
	},
}));

vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
	eq: vi.fn(),
	and: vi.fn(),
	inArray: vi.fn(),
}));

const {
	createCrate,
	updateCrate,
	toggleCrateVisibility,
	deleteCrate,
	addToCrate,
	moveToWantlist,
	moveToCollection,
	markAsFound,
	removeCrateItem,
	createSet,
	deleteSet,
	getUserCratesAction,
} = await import("@/actions/crates");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validCreateCrateInput() {
	return { name: "Record Fair Haul", date: "2026-04-13", sessionType: "digging_trip" };
}

function validAddToCrateInput() {
	return {
		crateId: CRATE_ID,
		releaseId: RELEASE_ID,
		discogsId: 12345,
		title: "Kind of Blue",
		artist: "Miles Davis",
		coverImageUrl: "https://example.com/cover.jpg",
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

// ---- createCrate ----------------------------------------------------------
describe("createCrate", () => {
	it("returns crateId on valid input", async () => {
		selectResults = [
			[{ crateId: CRATE_ID }], // insert returning
		];

		const result = await createCrate(validCreateCrateInput());
		expect(result.success).toBe(true);
		expect(result.data?.crateId).toBe(CRATE_ID);
	});

	it("rejects invalid schema (missing name)", async () => {
		const result = await createCrate({ date: "2026-04-13", sessionType: "other" });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects invalid schema (bad date format)", async () => {
		const result = await createCrate({ name: "Test", date: "April 13", sessionType: "other" });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects invalid schema (bad sessionType)", async () => {
		const result = await createCrate({
			name: "Test",
			date: "2026-04-13",
			sessionType: "invalid_type",
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await createCrate(validCreateCrateInput());
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- updateCrate ----------------------------------------------------------
describe("updateCrate", () => {
	it("succeeds with valid partial update", async () => {
		selectResults = [[]]; // update set where resolves

		const result = await updateCrate({ id: CRATE_ID, name: "Updated Name" });
		expect(result.success).toBe(true);
	});

	it("rejects invalid id", async () => {
		const result = await updateCrate({ id: "not-a-uuid", name: "Test" });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await updateCrate({ id: CRATE_ID, name: "Test" });
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- toggleCrateVisibility ------------------------------------------------
describe("toggleCrateVisibility", () => {
	it("succeeds for authenticated owner", async () => {
		selectResults = [[]]; // update set where resolves

		const result = await toggleCrateVisibility(CRATE_ID, true);
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await toggleCrateVisibility(CRATE_ID, true);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- deleteCrate ----------------------------------------------------------
describe("deleteCrate", () => {
	it("succeeds for authenticated owner", async () => {
		selectResults = [[]]; // delete where resolves

		const result = await deleteCrate(CRATE_ID);
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await deleteCrate(CRATE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- addToCrate -----------------------------------------------------------
describe("addToCrate", () => {
	it("returns crateItemId on valid input with owned crate", async () => {
		selectResults = [
			[{ id: CRATE_ID }], // ownership check returns crate
			[{ crateItemId: CRATE_ITEM_ID }], // insert returning
		];

		const result = await addToCrate(validAddToCrateInput());
		expect(result.success).toBe(true);
		expect(result.data?.crateItemId).toBe(CRATE_ITEM_ID);
	});

	it("rejects when crate not owned (ownership check fails)", async () => {
		selectResults = [
			[], // ownership check returns empty
		];

		const result = await addToCrate(validAddToCrateInput());
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found or access denied");
	});

	it("rejects invalid schema (missing crateId)", async () => {
		const result = await addToCrate({
			releaseId: RELEASE_ID,
			discogsId: 12345,
			title: "Test",
			artist: "Test",
			coverImageUrl: null,
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await addToCrate(validAddToCrateInput());
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- moveToWantlist -------------------------------------------------------
describe("moveToWantlist", () => {
	it("moves item and returns wantlistItemId", async () => {
		selectResults = [
			[{ id: CRATE_ITEM_ID, crateId: CRATE_ID, releaseId: RELEASE_ID, userId: USER_ID }], // lookup
			[{ wantlistItemId: "wl-item-1" }], // wantlist insert returning
			[], // update status
		];

		const result = await moveToWantlist(CRATE_ITEM_ID);
		expect(result.success).toBe(true);
		expect(result.data?.wantlistItemId).toBe("wl-item-1");
	});

	it("rejects when item not found", async () => {
		selectResults = [[]]; // lookup returns empty

		const result = await moveToWantlist(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("rejects invalid crate item id", async () => {
		const result = await moveToWantlist("not-a-uuid");
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await moveToWantlist(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- moveToCollection -----------------------------------------------------
describe("moveToCollection", () => {
	it("moves item and returns collectionItemId", async () => {
		selectResults = [
			[{ id: CRATE_ITEM_ID, crateId: CRATE_ID, releaseId: RELEASE_ID, userId: USER_ID }], // lookup
			[{ collectionItemId: "col-item-1" }], // collection insert returning
			[], // update status
		];

		const result = await moveToCollection(CRATE_ITEM_ID);
		expect(result.success).toBe(true);
		expect(result.data?.collectionItemId).toBe("col-item-1");
	});

	it("rejects when item not found", async () => {
		selectResults = [[]];

		const result = await moveToCollection(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await moveToCollection(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- markAsFound ----------------------------------------------------------
describe("markAsFound", () => {
	it("marks item as found for owner", async () => {
		selectResults = [
			[{ crateId: CRATE_ID }], // lookup returns item
			[], // update resolves
		];

		const result = await markAsFound(CRATE_ITEM_ID);
		expect(result.success).toBe(true);
	});

	it("rejects when item not found", async () => {
		selectResults = [[]];

		const result = await markAsFound(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await markAsFound(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- removeCrateItem ------------------------------------------------------
describe("removeCrateItem", () => {
	it("removes item for owner", async () => {
		selectResults = [
			[{ crateId: CRATE_ID }], // lookup returns item
			[], // delete resolves
		];

		const result = await removeCrateItem(CRATE_ITEM_ID);
		expect(result.success).toBe(true);
	});

	it("rejects when item not found", async () => {
		selectResults = [[]];

		const result = await removeCrateItem(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await removeCrateItem(CRATE_ITEM_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- createSet ------------------------------------------------------------
describe("createSet", () => {
	it("creates a set with tracks for owned crate", async () => {
		const trackIds = [CRATE_ITEM_ID];
		selectResults = [
			[{ id: CRATE_ID }], // crate ownership check
			[{ id: CRATE_ITEM_ID }], // verify track items belong to crate
			[{ setId: SET_ID }], // set insert returning
			[], // setTracks bulk insert
		];

		const result = await createSet({
			crateId: CRATE_ID,
			eventDate: "2026-04-13",
			venueName: "Local Record Shop",
			trackOrder: trackIds,
		});
		expect(result.success).toBe(true);
		expect(result.data?.setId).toBe(SET_ID);
	});

	it("rejects when crate not owned", async () => {
		selectResults = [
			[], // crate ownership returns empty
		];

		const result = await createSet({
			crateId: CRATE_ID,
			eventDate: null,
			venueName: null,
			trackOrder: [CRATE_ITEM_ID],
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found or access denied");
	});

	it("rejects invalid schema (empty trackOrder)", async () => {
		const result = await createSet({
			crateId: CRATE_ID,
			eventDate: null,
			venueName: null,
			trackOrder: [],
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await createSet({
			crateId: CRATE_ID,
			eventDate: null,
			venueName: null,
			trackOrder: [CRATE_ITEM_ID],
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- deleteSet ------------------------------------------------------------
describe("deleteSet", () => {
	it("deletes set for owner", async () => {
		selectResults = [
			[{ crateId: CRATE_ID }], // ownership check
			[], // delete resolves
		];

		const result = await deleteSet(SET_ID);
		expect(result.success).toBe(true);
	});

	it("rejects when set not found", async () => {
		selectResults = [[]]; // ownership check returns empty

		const result = await deleteSet(SET_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await deleteSet(SET_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});

// ---- getUserCratesAction --------------------------------------------------
describe("getUserCratesAction", () => {
	it("returns array of crates for authenticated user", async () => {
		const mockCrates = [
			{ id: CRATE_ID, name: "My Crate", itemCount: 5 },
			{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", name: "Another Crate", itemCount: 0 },
		];
		selectResults = [mockCrates]; // getCrates returns this

		const result = await getUserCratesAction();
		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(2);
		expect(result.data?.[0]?.name).toBe("My Crate");
	});

	it("returns empty array when user has no crates", async () => {
		selectResults = [[]]; // getCrates returns empty

		const result = await getUserCratesAction();
		expect(result.success).toBe(true);
		expect(result.data).toHaveLength(0);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await getUserCratesAction();
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});
