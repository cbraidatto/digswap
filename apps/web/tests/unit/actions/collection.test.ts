import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-111111111111";
const OTHER_USER_ID = "user-2222-2222-2222-222222222222";
const COLLECTION_ITEM_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RELEASE_ID = "rrrrrrrr-rrrr-4rrr-8rrr-rrrrrrrrrrrr";

// ---------------------------------------------------------------------------
// Mocks - Supabase chain builder
// ---------------------------------------------------------------------------
let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };

// Sequential result queue for admin client queries
let adminResults: unknown[] = [];
let adminCallCount = 0;

function nextAdminResult() {
	const result = adminCallCount < adminResults.length ? adminResults[adminCallCount] : undefined;
	adminCallCount++;
	return result;
}

// Build a fluent Supabase-like chain that resolves from adminResults
function makeChain(): Record<string, unknown> {
	const chain: Record<string, unknown> = {};

	const fluent = [
		"from",
		"select",
		"insert",
		"update",
		"delete",
		"eq",
		"neq",
		"gt",
		"gte",
		"lt",
		"lte",
		"in",
		"is",
		"order",
		"limit",
		"range",
	];

	for (const m of fluent) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	// Terminal methods that consume from the result queue
	chain.single = vi.fn().mockImplementation(() => {
		const r = nextAdminResult();
		return r !== undefined ? r : { data: null, error: null };
	});

	chain.maybeSingle = vi.fn().mockImplementation(() => {
		const r = nextAdminResult();
		return r !== undefined ? r : { data: null, error: null };
	});

	// For queries that don't call .single()/.maybeSingle() — the chain itself resolves
	chain.then = (resolve: (v: unknown) => void) => {
		const r = nextAdminResult();
		return resolve(r !== undefined ? r : { data: null, error: null });
	};

	return chain;
}

let adminChain: Record<string, unknown>;

// Auth client mock (createClient)
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

// Admin client mock (createAdminClient)
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => adminChain),
}));

// Rate limiter — always succeeds by default
vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

// Discogs client mock
const mockSearch = vi.fn();
const mockGetRelease = vi.fn();
vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn(async () => ({
		database: () => ({
			search: mockSearch,
			getRelease: mockGetRelease,
		}),
	})),
	computeRarityScore: vi.fn(() => 2.5),
}));

// Non-blocking side effects — stub them out
vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn(async () => {}),
}));

vi.mock("@/lib/notifications/match", () => ({
	checkWantlistMatches: vi.fn(async () => {}),
}));

vi.mock("@/lib/social/log-activity", () => ({
	logActivity: vi.fn(async () => {}),
}));

// ---------------------------------------------------------------------------
// Import actions under test (AFTER mocks are registered)
// ---------------------------------------------------------------------------
const {
	searchDiscogs,
	addRecordToCollection,
	updateConditionGrade,
	removeRecordFromCollection,
	setVisibility,
	updateQualityMetadata,
	updateCollectionNotes,
	setPersonalRating,
} = await import("@/actions/collection");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	adminResults = [];
	adminCallCount = 0;
	adminChain = makeChain();
	vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// searchDiscogs
// ---------------------------------------------------------------------------
describe("searchDiscogs", () => {
	it("returns empty array when user is not authenticated", async () => {
		mockAuthUser = null;
		const result = await searchDiscogs("test");
		expect(result).toEqual([]);
	});

	it("returns empty array for empty query", async () => {
		const result = await searchDiscogs("");
		expect(result).toEqual([]);
	});

	it("returns empty array for query over 200 chars", async () => {
		const result = await searchDiscogs("a".repeat(201));
		expect(result).toEqual([]);
	});

	it("returns mapped results on success", async () => {
		mockSearch.mockResolvedValue({
			data: {
				results: [
					{
						id: 12345,
						title: "Test Album",
						cover_image: "http://img.com/cover.jpg",
						year: "1985",
						format: ["Vinyl"],
						genre: ["Rock"],
						country: "US",
						community: { have: 100, want: 50 },
					},
				],
			},
		});

		const result = await searchDiscogs("Test Album");
		expect(result).toHaveLength(1);
		expect(result[0]).toEqual({
			discogsId: 12345,
			title: "Test Album",
			coverImage: "http://img.com/cover.jpg",
			year: "1985",
			format: "Vinyl",
			genre: ["Rock"],
			country: "US",
			have: 100,
			want: 50,
		});
	});
});

// ---------------------------------------------------------------------------
// addRecordToCollection
// ---------------------------------------------------------------------------
describe("addRecordToCollection", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await addRecordToCollection(12345);
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid discogsId (negative)", async () => {
		const result = await addRecordToCollection(-1);
		expect(result.error).toBe("Invalid Discogs ID.");
	});

	it("rejects invalid discogsId (float)", async () => {
		const result = await addRecordToCollection(1.5);
		expect(result.error).toBe("Invalid Discogs ID.");
	});

	it("returns error when record already in collection", async () => {
		// First query: release exists
		adminResults = [
			{ data: { id: RELEASE_ID }, error: null }, // existing release found
			{ data: { id: COLLECTION_ITEM_ID }, error: null }, // duplicate check finds it
		];

		const result = await addRecordToCollection(12345);
		expect(result.error).toBe("Record already in your collection");
	});

	it("succeeds when adding new record (release exists)", async () => {
		adminResults = [
			{ data: { id: RELEASE_ID }, error: null }, // existing release found
			{ data: null, error: null }, // no duplicate
			{ data: null, error: null }, // insert collection item OK
			{ data: null, error: null, count: 1 }, // badge: count collection items
			{ data: { rarity_score: 1.0 }, error: null }, // badge: rarity check
		];

		const result = await addRecordToCollection(12345);
		expect(result.success).toBe(true);
	});

	it("fetches from Discogs when release not in DB", async () => {
		mockGetRelease.mockResolvedValue({
			data: {
				id: 99999,
				title: "New Release",
				artists: [{ name: "Artist" }],
				year: "2020",
				genres: ["Jazz"],
				styles: ["Bop"],
				formats: [{ name: "LP" }],
				images: [{ uri: "http://img.com/new.jpg" }],
				community: { have: 10, want: 5 },
				tracklist: [{ position: "A1", title: "Track 1", duration: "3:30" }],
			},
		});

		adminResults = [
			{ data: null, error: null }, // no existing release
			{ data: { id: RELEASE_ID }, error: null }, // insert release succeeds
			{ data: null, error: null }, // no duplicate collection item
			{ data: null, error: null }, // insert collection item OK
			{ data: null, error: null, count: 1 }, // badge count
			{ data: { rarity_score: 1.0 }, error: null }, // rarity check
		];

		const result = await addRecordToCollection(99999);
		expect(result.success).toBe(true);
		expect(mockGetRelease).toHaveBeenCalledWith(99999);
	});
});

// ---------------------------------------------------------------------------
// updateConditionGrade
// ---------------------------------------------------------------------------
describe("updateConditionGrade", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await updateConditionGrade(COLLECTION_ITEM_ID, "Mint");
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid condition grade", async () => {
		const result = await updateConditionGrade(COLLECTION_ITEM_ID, "Terrible");
		expect(result.error).toBe("Invalid condition grade.");
	});

	it("rejects valid grade values", async () => {
		// Each valid grade should NOT return validation error
		for (const grade of ["Mint", "VG+", "VG", "G+", "G", "F", "P"]) {
			adminCallCount = 0;
			adminChain = makeChain();
			adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

			const result = await updateConditionGrade(COLLECTION_ITEM_ID, grade);
			expect(result.success).toBe(true);
		}
	});

	it("returns not found for IDOR (other user's item)", async () => {
		// The .eq("user_id", user.id) filter means no row returned
		adminResults = [{ data: null, error: null }];

		const result = await updateConditionGrade(COLLECTION_ITEM_ID, "VG+");
		expect(result.error).toBe("Not found");
	});

	it("succeeds for own item", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await updateConditionGrade(COLLECTION_ITEM_ID, "VG+");
		expect(result.success).toBe(true);
	});

	it("returns error on DB failure", async () => {
		adminResults = [{ data: null, error: { message: "DB error" } }];

		const result = await updateConditionGrade(COLLECTION_ITEM_ID, "VG+");
		expect(result.error).toBe("Could not update condition grade.");
	});
});

// ---------------------------------------------------------------------------
// removeRecordFromCollection
// ---------------------------------------------------------------------------
describe("removeRecordFromCollection", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await removeRecordFromCollection(COLLECTION_ITEM_ID);
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid UUID", async () => {
		const result = await removeRecordFromCollection("not-a-uuid");
		expect(result.error).toBe("Invalid collection item ID.");
	});

	it("returns not found for IDOR (other user's item)", async () => {
		adminResults = [{ data: null, error: null }];

		const result = await removeRecordFromCollection(COLLECTION_ITEM_ID);
		expect(result.error).toBe("Not found");
	});

	it("succeeds for own item", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await removeRecordFromCollection(COLLECTION_ITEM_ID);
		expect(result.success).toBe(true);
	});

	it("returns error on DB failure", async () => {
		adminResults = [{ data: null, error: { message: "DB error" } }];

		const result = await removeRecordFromCollection(COLLECTION_ITEM_ID);
		expect(result.error).toBe("Could not remove record from collection.");
	});
});

// ---------------------------------------------------------------------------
// setVisibility
// ---------------------------------------------------------------------------
describe("setVisibility", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await setVisibility(COLLECTION_ITEM_ID, "tradeable");
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid UUID", async () => {
		const result = await setVisibility("bad-id", "tradeable");
		expect(result.error).toBe("Invalid ID.");
	});

	it("rejects invalid visibility value", async () => {
		const result = await setVisibility(COLLECTION_ITEM_ID, "hidden");
		expect(result.error).toBe("Invalid visibility value.");
	});

	it("accepts all valid visibility values", async () => {
		for (const vis of ["tradeable", "not_trading", "private"]) {
			adminCallCount = 0;
			adminChain = makeChain();
			adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

			const result = await setVisibility(COLLECTION_ITEM_ID, vis);
			expect(result.success).toBe(true);
		}
	});

	it("returns not found for IDOR", async () => {
		adminResults = [{ data: null, error: null }];

		const result = await setVisibility(COLLECTION_ITEM_ID, "tradeable");
		expect(result.error).toBe("Not found");
	});

	it("returns error on DB failure", async () => {
		adminResults = [{ data: null, error: { message: "DB error" } }];

		const result = await setVisibility(COLLECTION_ITEM_ID, "tradeable");
		expect(result.error).toBe("Could not update visibility.");
	});
});

// ---------------------------------------------------------------------------
// updateQualityMetadata
// ---------------------------------------------------------------------------
describe("updateQualityMetadata", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, { audioFormat: "FLAC" });
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid UUID", async () => {
		const result = await updateQualityMetadata("bad-id", { audioFormat: "FLAC" });
		expect(result.error).toBe("Invalid ID.");
	});

	it("rejects invalid metadata (format too long)", async () => {
		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, {
			audioFormat: "A".repeat(51),
		});
		expect(result.error).toBe("Invalid quality metadata.");
	});

	it("rejects invalid bitrate (negative)", async () => {
		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, { bitrate: -1 });
		expect(result.error).toBe("Invalid quality metadata.");
	});

	it("rejects invalid sampleRate (exceeds max)", async () => {
		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, { sampleRate: 999999 });
		expect(result.error).toBe("Invalid quality metadata.");
	});

	it("succeeds with valid metadata", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, {
			audioFormat: "FLAC",
			bitrate: 320,
			sampleRate: 44100,
		});
		expect(result.success).toBe(true);
	});

	it("returns not found for IDOR", async () => {
		adminResults = [{ data: null, error: null }];

		const result = await updateQualityMetadata(COLLECTION_ITEM_ID, { audioFormat: "MP3" });
		expect(result.error).toBe("Not found");
	});
});

// ---------------------------------------------------------------------------
// updateCollectionNotes
// ---------------------------------------------------------------------------
describe("updateCollectionNotes", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await updateCollectionNotes(COLLECTION_ITEM_ID, "some notes");
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid UUID", async () => {
		const result = await updateCollectionNotes("bad-id", "notes");
		expect(result.error).toBe("Invalid ID.");
	});

	it("succeeds with valid notes", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await updateCollectionNotes(COLLECTION_ITEM_ID, "Great pressing!");
		expect(result.success).toBe(true);
	});

	it("succeeds with null notes (clearing)", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await updateCollectionNotes(COLLECTION_ITEM_ID, null);
		expect(result.success).toBe(true);
	});

	it("returns error when item not found (IDOR)", async () => {
		adminResults = [{ data: null, error: null }];

		const result = await updateCollectionNotes(COLLECTION_ITEM_ID, "notes");
		expect(result.error).toBe("Could not update.");
	});

	it("returns error on DB failure", async () => {
		adminResults = [{ data: null, error: { message: "DB error" } }];

		const result = await updateCollectionNotes(COLLECTION_ITEM_ID, "notes");
		expect(result.error).toBe("Could not update.");
	});
});

// ---------------------------------------------------------------------------
// setPersonalRating
// ---------------------------------------------------------------------------
describe("setPersonalRating", () => {
	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await setPersonalRating(COLLECTION_ITEM_ID, 3);
		expect(result.error).toBe("Not authenticated");
	});

	it("rejects invalid UUID", async () => {
		const result = await setPersonalRating("bad-id", 3);
		expect(result.error).toBe("Invalid ID.");
	});

	it("rejects rating below 1", async () => {
		const result = await setPersonalRating(COLLECTION_ITEM_ID, 0);
		expect(result.error).toBe("Rating must be 1-5.");
	});

	it("rejects rating above 5", async () => {
		const result = await setPersonalRating(COLLECTION_ITEM_ID, 6);
		expect(result.error).toBe("Rating must be 1-5.");
	});

	it("rejects non-integer rating", async () => {
		const result = await setPersonalRating(COLLECTION_ITEM_ID, 3.5);
		expect(result.error).toBe("Rating must be 1-5.");
	});

	it("succeeds with valid rating", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await setPersonalRating(COLLECTION_ITEM_ID, 4);
		expect(result.success).toBe(true);
	});

	it("succeeds with null rating (clearing)", async () => {
		adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

		const result = await setPersonalRating(COLLECTION_ITEM_ID, null);
		expect(result.success).toBe(true);
	});

	it("accepts all valid ratings 1-5", async () => {
		for (const rating of [1, 2, 3, 4, 5]) {
			adminCallCount = 0;
			adminChain = makeChain();
			adminResults = [{ data: { id: COLLECTION_ITEM_ID }, error: null }];

			const result = await setPersonalRating(COLLECTION_ITEM_ID, rating);
			expect(result.success).toBe(true);
		}
	});

	it("returns error when item not found (IDOR)", async () => {
		adminResults = [{ data: null, error: null }];

		const result = await setPersonalRating(COLLECTION_ITEM_ID, 3);
		expect(result.error).toBe("Could not update.");
	});
});
