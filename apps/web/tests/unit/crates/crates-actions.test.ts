import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted state — vi.mock factories are hoisted above imports so all shared
// state must also be hoisted to be accessible in both factory and test body.
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => {
	// Shared query counter — reset in beforeEach
	let _callCount = 0;
	let _results: unknown[][] = [];

	const mockGetUser = vi.fn();
	const insertValuesSpy = vi.fn();
	const insertReturning = vi.fn();
	const deleteWhereSpy = vi.fn();
	const updateSetSpy = vi.fn();
	const updateWhereSpy = vi.fn();

	return {
		mockGetUser,
		insertValuesSpy,
		insertReturning,
		deleteWhereSpy,
		updateSetSpy,
		updateWhereSpy,
		// Helpers for queryResults state
		nextResult: () => {
			const r = _results[_callCount] ?? [];
			_callCount++;
			return r;
		},
		setResults: (r: unknown[][]) => {
			_results = r;
			_callCount = 0;
		},
		resetState: () => {
			_callCount = 0;
			_results = [];
		},
	};
});

// ---------------------------------------------------------------------------
// next/cache mock
// ---------------------------------------------------------------------------
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Supabase auth mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: { getUser: mocks.mockGetUser },
	})),
}));

// ---------------------------------------------------------------------------
// Drizzle DB mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/db", () => {
	const makeSelectChain = () => {
		const chain: Record<string, unknown> = {};
		const chainMethods = ["from", "where", "limit", "innerJoin", "leftJoin", "groupBy", "offset", "orderBy"];
		for (const m of chainMethods) {
			chain[m] = vi.fn().mockReturnValue(chain);
		}
		chain.then = (resolve: (v: unknown) => void) => resolve(mocks.nextResult());
		return chain;
	};

	return {
		db: {
			select: vi.fn().mockImplementation(() => makeSelectChain()),
			// Delegate to insertValuesSpy directly — never override its implementation here
			insert: vi.fn().mockImplementation(() => ({ values: mocks.insertValuesSpy })),
			update: vi.fn().mockImplementation(() => ({ set: mocks.updateSetSpy })),
			delete: vi.fn().mockImplementation(() => ({ where: mocks.deleteWhereSpy })),
		},
	};
});

// ---------------------------------------------------------------------------
// Schema mocks — minimal column symbols for drizzle queries
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/schema/crates", () => ({
	crates: { id: "crates.id", userId: "crates.userId" },
	crateItems: {
		id: "crateItems.id",
		crateId: "crateItems.crateId",
		userId: "crateItems.userId",
	},
	sets: { id: "sets.id", userId: "sets.userId", crateId: "sets.crateId" },
	setTracks: { id: "setTracks.id", setId: "setTracks.setId" },
}));

vi.mock("@/lib/db/schema/wantlist", () => ({
	wantlistItems: { id: "wantlistItems.id", userId: "wantlistItems.userId" },
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: {
		id: "collectionItems.id",
		userId: "collectionItems.userId",
	},
}));

// ---------------------------------------------------------------------------
// drizzle-orm mock
// ---------------------------------------------------------------------------
vi.mock("drizzle-orm", () => ({
	eq: vi.fn((_a, _b) => ({})),
	and: vi.fn((..._args) => ({})),
	inArray: vi.fn((_col, _vals) => ({})),
}));

// ---------------------------------------------------------------------------
// Crates queries mock (getUserCratesAction)
// ---------------------------------------------------------------------------
vi.mock("@/lib/crates/queries", () => ({
	getCrates: vi.fn().mockResolvedValue([]),
}));

// ---------------------------------------------------------------------------
// Import actions after all mocks are in place
// ---------------------------------------------------------------------------
import {
	createCrate,
	addToCrate,
	moveToWantlist,
	moveToCollection,
	markAsFound,
	createSet,
	updateSetTracks,
} from "@/actions/crates";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const CRATE_ID = "b1ffc99a-1c0b-4ef8-bb6d-6bb9bd380a11";
const CRATE_ITEM_ID = "c2ddc99b-2c0b-4ef8-bb6d-6bb9bd380a11";
const SET_ID = "d3eec99c-3c0b-4ef8-bb6d-6bb9bd380a11";
const ITEM_ID_A = "e4ffc99d-4c0b-4ef8-bb6d-6bb9bd380a11";
const ITEM_ID_B = "f500c99e-5c0b-4ef8-bb6d-6bb9bd380a11";
const ITEM_ID_C = "a601c99f-6c0b-4ef8-bb6d-6bb9bd380a11";
const TODAY = "2026-03-29";

describe("crates server actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.resetState();

		// Re-establish implementations after clearAllMocks resets them
		mocks.mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});

		// Default: insert().values().returning() → resolves via nextResult()
		mocks.insertReturning.mockImplementation(() => ({
			then: (resolve: (v: unknown) => void) => resolve(mocks.nextResult()),
		}));
		mocks.insertValuesSpy.mockImplementation(() => ({
			returning: mocks.insertReturning,
		}));

		// Default: update().set().where() → resolves void
		mocks.updateWhereSpy.mockResolvedValue(undefined);
		mocks.updateSetSpy.mockImplementation(() => ({ where: mocks.updateWhereSpy }));

		// Default: delete().where() → resolves void
		mocks.deleteWhereSpy.mockResolvedValue(undefined);
	});

	// -------------------------------------------------------------------------
	// 1. createCrate
	// -------------------------------------------------------------------------
	it("createCrate with valid input returns { success: true, data: { crateId: string } }", async () => {
		// insert(crates).values().returning() → [{ crateId }]
		mocks.setResults([[{ crateId: CRATE_ID }]]);

		const result = await createCrate({
			name: "Sabado Dig",
			date: TODAY,
			sessionType: "digging_trip",
		});

		expect(result.success).toBe(true);
		expect(result.data?.crateId).toBe(CRATE_ID);
	});

	// -------------------------------------------------------------------------
	// 2. addToCrate — IDOR guard
	// -------------------------------------------------------------------------
	it("addToCrate when crate belongs to another user returns { success: false, error: ... }", async () => {
		// select(crates).where(userId = otherUser) → [] (ownership check fails)
		mocks.setResults([[]]);

		const result = await addToCrate({
			crateId: CRATE_ID,
			releaseId: null,
			discogsId: 12345,
			title: "Some Record",
			artist: "Artist",
			coverImageUrl: null,
		});

		expect(result.success).toBe(false);
		expect(result.error).toBeTruthy();
	});

	// -------------------------------------------------------------------------
	// 3. moveToWantlist
	// -------------------------------------------------------------------------
	it("moveToWantlist on active item returns success and item status becomes 'found'", async () => {
		mocks.setResults([
			// select(crateItems) → found item
			[{
				id: CRATE_ITEM_ID,
				crateId: CRATE_ID,
				userId: USER_ID,
				releaseId: "b802c99e-7c0b-4ef8-bb6d-6bb9bd380a11",
				status: "active",
			}],
			// insert(wantlistItems).returning() → [{wantlistItemId}]
			[{ wantlistItemId: "c903c99f-8c0b-4ef8-bb6d-6bb9bd380a11" }],
		]);

		const result = await moveToWantlist(CRATE_ITEM_ID);

		expect(result.success).toBe(true);
		expect(mocks.updateSetSpy).toHaveBeenCalledWith({ status: "found" });
	});

	// -------------------------------------------------------------------------
	// 4. moveToCollection
	// -------------------------------------------------------------------------
	it("moveToCollection on active item returns success and item status becomes 'found'", async () => {
		mocks.setResults([
			// select(crateItems) → found item
			[{
				id: CRATE_ITEM_ID,
				crateId: CRATE_ID,
				userId: USER_ID,
				releaseId: "b802c99e-7c0b-4ef8-bb6d-6bb9bd380a11",
				status: "active",
			}],
			// insert(collectionItems).returning() → [{collectionItemId}]
			[{ collectionItemId: "da04c99a-9c0b-4ef8-bb6d-6bb9bd380a11" }],
		]);

		const result = await moveToCollection(CRATE_ITEM_ID);

		expect(result.success).toBe(true);
		expect(mocks.updateSetSpy).toHaveBeenCalledWith({ status: "found" });
	});

	// -------------------------------------------------------------------------
	// 5. markAsFound
	// -------------------------------------------------------------------------
	it("markAsFound returns success", async () => {
		mocks.setResults([
			// select(crateItems) → item with crateId
			[{ crateId: CRATE_ID }],
		]);

		const result = await markAsFound(CRATE_ITEM_ID);

		expect(result.success).toBe(true);
		expect(mocks.updateSetSpy).toHaveBeenCalledWith({ status: "found" });
	});

	// -------------------------------------------------------------------------
	// 6. createSet — positions [1, 2, 3] in trackOrder order
	// -------------------------------------------------------------------------
	it("createSet stores set_tracks with positions [1, 2, 3] in trackOrder order", async () => {
		const trackOrder = [ITEM_ID_A, ITEM_ID_B, ITEM_ID_C];

		mocks.setResults([
			// select(crates) ownership check → [{ id }]
			[{ id: CRATE_ID }],
			// select(crateItems) inArray → all 3 items
			[{ id: ITEM_ID_A }, { id: ITEM_ID_B }, { id: ITEM_ID_C }],
			// insert(sets).returning() → [{ setId }]
			[{ setId: SET_ID }],
			// insert(setTracks).values() — no returning, resolves []
			[],
		]);

		// Intercept values() to capture all inserts while keeping returning() working
		mocks.insertValuesSpy.mockImplementation((vals: unknown) => ({
			returning: mocks.insertReturning,
		}));

		const result = await createSet({
			crateId: CRATE_ID,
			eventDate: TODAY,
			venueName: "Fabric, London",
			trackOrder,
		});

		expect(result.success).toBe(true);
		expect(result.data?.setId).toBe(SET_ID);

		// createSet calls insert twice: once for the set row, once for set_tracks.
		// The set_tracks insert receives an array of 3 objects.
		const allCalls = mocks.insertValuesSpy.mock.calls;
		const trackCall = allCalls.find(
			(call: unknown[]) => Array.isArray(call[0]) && (call[0] as unknown[]).length === 3,
		);
		expect(trackCall).toBeTruthy();

		const tracks = trackCall![0] as Array<{
			crateItemId: string;
			position: number;
		}>;
		expect(tracks[0]).toMatchObject({ crateItemId: ITEM_ID_A, position: 1 });
		expect(tracks[1]).toMatchObject({ crateItemId: ITEM_ID_B, position: 2 });
		expect(tracks[2]).toMatchObject({ crateItemId: ITEM_ID_C, position: 3 });
	});

	// -------------------------------------------------------------------------
	// 7. updateSetTracks — replaces existing tracks and recomputes positions
	// -------------------------------------------------------------------------
	it("updateSetTracks replaces existing tracks and recomputes positions contiguously", async () => {
		const newTrackOrder = [ITEM_ID_C, ITEM_ID_A]; // C first → position 1, A second → position 2

		mocks.setResults([
			// select(sets) ownership check → [{ id, crateId }]
			[{ id: SET_ID, crateId: CRATE_ID }],
		]);

		// Use default insertValuesSpy from beforeEach; just capture calls via mock.calls

		const result = await updateSetTracks({
			setId: SET_ID,
			trackOrder: newTrackOrder,
		});

		expect(result.success).toBe(true);

		// Existing tracks were deleted before re-inserting
		expect(mocks.deleteWhereSpy).toHaveBeenCalled();

		// New positions are contiguous starting from 1, in order of newTrackOrder
		expect(mocks.insertValuesSpy).toHaveBeenCalled();
		const calls = mocks.insertValuesSpy.mock.calls;
		const trackCall = calls.find(
			(call: unknown[]) => Array.isArray(call[0]) && (call[0] as unknown[]).length === 2,
		);
		expect(trackCall).toBeTruthy();
		const tracks = trackCall![0] as Array<{
			crateItemId: string;
			position: number;
		}>;
		expect(tracks).toHaveLength(2);
		expect(tracks[0]).toMatchObject({ crateItemId: ITEM_ID_C, position: 1 });
		expect(tracks[1]).toMatchObject({ crateItemId: ITEM_ID_A, position: 2 });
	});
});
