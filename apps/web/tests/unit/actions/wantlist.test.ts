import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-111111111111";
const WANTLIST_ITEM_ID = "wl-222222-2222-2222-222222222222";
const RELEASE_ID = "rel-33333-3333-3333-333333333333";

let mockAuthUser: { id: string } | null = { id: USER_ID };

// Track admin client calls
let adminFromCalls: { table: string; method: string; args: unknown[] }[] = [];

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: mockAuthUser ? null : { message: "Not auth" },
			})),
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

// Admin client mock with chainable API that supports the patterns in wantlist.ts
function createMockAdminChain(overrides?: {
	selectData?: unknown;
	insertData?: unknown;
	insertError?: { code: string; message: string } | null;
	deleteError?: { message: string } | null;
	updateError?: { message: string } | null;
}) {
	const makeChain = (): Record<string, unknown> => {
		const c: Record<string, unknown> = {};
		c.select = vi.fn(() => c);
		c.insert = vi.fn(() => c);
		c.update = vi.fn(() => c);
		c.delete = vi.fn(() => c);
		c.eq = vi.fn(() => c);
		c.neq = vi.fn(() => c);
		c.maybeSingle = vi.fn(async () => ({ data: overrides?.selectData ?? null, error: null }));
		c.single = vi.fn(async () => ({
			data: overrides?.insertData ?? { id: RELEASE_ID },
			error: overrides?.insertError ?? null,
		}));
		// For count queries
		c.then = undefined;
		c.data = overrides?.selectData;
		c.error = overrides?.deleteError ?? overrides?.updateError ?? null;
		c.count = 0;
		return c;
	};

	return {
		from: vi.fn((table: string) => {
			adminFromCalls.push({ table, method: "from", args: [table] });
			return makeChain();
		}),
	};
}

let mockAdminClient = createMockAdminChain();

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => mockAdminClient),
}));

vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn(async () => ({
		database: vi.fn(() => ({
			getRelease: vi.fn(async () => ({
				data: {
					id: 12345,
					title: "Blue Train",
					artists: [{ name: "John Coltrane" }],
					year: 1957,
					genres: ["Jazz"],
					styles: ["Hard Bop"],
					formats: [{ name: "Vinyl" }],
					images: [{ uri: "https://img.discogs.com/test.jpg" }],
					community: { have: 1000, want: 500 },
				},
			})),
		})),
	})),
	computeRarityScore: vi.fn(() => 0.65),
}));

vi.mock("@/lib/youtube/client", () => ({
	searchYouTube: vi.fn(),
}));

vi.mock("@/lib/validations/wantlist", () => ({
	addToWantlistSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { discogsId?: number };
			if (d?.discogsId && Number.isInteger(d.discogsId) && d.discogsId > 0) {
				return { success: true, data: d };
			}
			return { success: false, error: { issues: [{ message: "Invalid Discogs ID" }] } };
		}),
	},
	wantlistItemIdSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { wantlistItemId?: string };
			if (d?.wantlistItemId && d.wantlistItemId.length > 0) {
				return { success: true, data: d };
			}
			return { success: false };
		}),
	},
	addFromYouTubeSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as {
				videoId?: string;
				title?: string;
				channelTitle?: string;
				thumbnail?: string;
			};
			if (d?.videoId && d?.title && d?.channelTitle && d?.thumbnail) {
				return { success: true, data: d };
			}
			return { success: false, error: { issues: [{ message: "Invalid input" }] } };
		}),
	},
}));

const { addToWantlist, removeFromWantlist, markAsFound } = await import("@/actions/wantlist");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	adminFromCalls = [];
	mockAdminClient = createMockAdminChain();
	vi.clearAllMocks();
});

describe("addToWantlist", () => {
	it("returns error for invalid discogs ID", async () => {
		const result = await addToWantlist(-1);
		expect(result.error).toBeDefined();
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await addToWantlist(12345);
		expect(result.error).toBe("Not authenticated");
	});

	it("proceeds for valid authenticated request", async () => {
		// existingRelease returns something so we skip Discogs fetch
		mockAdminClient = createMockAdminChain({ selectData: { id: RELEASE_ID } });
		const result = await addToWantlist(12345);
		// Should reach admin client calls
		expect(adminFromCalls.length).toBeGreaterThan(0);
		expect(adminFromCalls[0].args[0]).toBe("releases");
	});
});

describe("removeFromWantlist", () => {
	it("returns error for empty wantlist item ID", async () => {
		const result = await removeFromWantlist("");
		expect(result.error).toBe("Invalid wantlist item ID");
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await removeFromWantlist(WANTLIST_ITEM_ID);
		expect(result.error).toBe("Not authenticated");
	});

	it("calls delete on admin client for valid request", async () => {
		const result = await removeFromWantlist(WANTLIST_ITEM_ID);
		expect(adminFromCalls.some((c) => c.args[0] === "wantlist_items")).toBe(true);
	});
});

describe("markAsFound", () => {
	it("returns error for empty wantlist item ID", async () => {
		const result = await markAsFound("");
		expect(result.error).toBe("Invalid wantlist item ID");
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await markAsFound(WANTLIST_ITEM_ID);
		expect(result.error).toBe("Not authenticated");
	});

	it("returns error when item not found", async () => {
		// maybeSingle returns null
		mockAdminClient = createMockAdminChain({ selectData: null });
		const result = await markAsFound(WANTLIST_ITEM_ID);
		expect(result.error).toBe("Could not find wantlist item.");
	});
});
