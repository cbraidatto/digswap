import { describe, test, expect, vi, beforeEach } from "vitest";

// -- Mock Supabase server client --
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({
		auth: {
			getUser: () => mockGetUser(),
		},
	}),
}))
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));
;

// -- Chainable admin mock --
function createChainedMock(resolveValue: unknown = { data: null, error: null }) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.select = vi.fn().mockReturnValue(chain);
	chain.insert = vi.fn().mockReturnValue(chain);
	chain.update = vi.fn().mockReturnValue(chain);
	chain.eq = vi.fn().mockReturnValue(chain);
	chain.single = vi.fn().mockResolvedValue(resolveValue);
	chain.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
	return chain;
}

let fromHandlers: Record<string, ReturnType<typeof createChainedMock>> = {};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn((table: string) => {
			if (fromHandlers[table]) return fromHandlers[table];
			return createChainedMock();
		}),
	})),
}));

// -- Mock Discogs client --
const mockGetRelease = vi.fn();

vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn().mockResolvedValue({
		database: () => ({
			getRelease: mockGetRelease,
			search: vi.fn(),
		}),
	}),
	computeRarityScore: vi.fn((have: number, want: number) => {
		if (have === 0 && want === 0) return null;
		if (have === 0) return 1.0;
		return want / have;
	}),
}));

// -- Mock next/headers --
vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

import { addRecordToCollection } from "@/actions/collection";

const USER_ID = "user-uuid-123";

describe("addRecordToCollection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fromHandlers = {};
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
	});

	test("inserts new release and collection item for unknown discogsId", async () => {
		// Release not found in DB
		const releasesChain = createChainedMock({ data: null, error: null });
		fromHandlers["releases"] = releasesChain;

		// After insert, return new release ID
		const insertChain = createChainedMock({ data: { id: "new-release-id" }, error: null });
		releasesChain.insert = vi.fn().mockReturnValue(insertChain);

		// No duplicate collection item
		const collectionChain = createChainedMock({ data: null, error: null });
		collectionChain.insert = vi.fn().mockResolvedValue({ error: null });
		fromHandlers["collection_items"] = collectionChain;

		// Discogs API returns release data
		mockGetRelease.mockResolvedValue({
			data: {
				id: 12345,
				title: "Kind of Blue",
				artists: [{ name: "Miles Davis" }],
				year: 1959,
				genres: ["Jazz"],
				styles: ["Modal"],
				formats: [{ name: "LP" }],
				images: [{ uri: "https://img.discogs.com/abc.jpg" }],
				community: { have: 50000, want: 12000 },
			},
		});

		const result = await addRecordToCollection(12345);

		expect(result).toEqual({ success: true });
		expect(mockGetRelease).toHaveBeenCalledWith(12345);
		expect(releasesChain.insert).toHaveBeenCalled();
	});

	test("reuses existing release for known discogsId", async () => {
		// Release already exists in DB
		const releasesChain = createChainedMock({ data: { id: "existing-release-id" }, error: null });
		fromHandlers["releases"] = releasesChain;

		// No duplicate collection item
		const collectionChain = createChainedMock({ data: null, error: null });
		collectionChain.insert = vi.fn().mockResolvedValue({ error: null });
		fromHandlers["collection_items"] = collectionChain;

		const result = await addRecordToCollection(12345);

		expect(result).toEqual({ success: true });
		// Should NOT fetch from Discogs API since release exists
		expect(mockGetRelease).not.toHaveBeenCalled();
	});

	test("returns error for duplicate collection item", async () => {
		// Release exists
		const releasesChain = createChainedMock({ data: { id: "existing-release-id" }, error: null });
		fromHandlers["releases"] = releasesChain;

		// Duplicate found
		const collectionChain = createChainedMock({ data: { id: "existing-item-id" }, error: null });
		fromHandlers["collection_items"] = collectionChain;

		const result = await addRecordToCollection(12345);

		expect(result).toEqual({ error: "Record already in your collection" });
	});

	test("returns error for unauthenticated user", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});

		const result = await addRecordToCollection(12345);
		expect(result).toHaveProperty("error");
		expect(result.error).toMatch(/not authenticated/i);
	});
});
