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

// -- Mock next/headers --
vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: vi.fn(),
		set: vi.fn(),
		delete: vi.fn(),
	}),
}));

// Mock discogs client (needed by collection.ts module)
vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn(),
	computeRarityScore: vi.fn(),
}));

import { updateConditionGrade } from "@/actions/collection";

const USER_ID = "user-uuid-456";

describe("updateConditionGrade", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fromHandlers = {};
		mockGetUser.mockResolvedValue({
			data: { user: { id: USER_ID } },
		});
	});

	test("updates condition grade on own collection item", async () => {
		// Update succeeds: returns the updated row
		const collectionChain = createChainedMock({ data: { id: "item-1" }, error: null });
		fromHandlers["collection_items"] = collectionChain;

		const result = await updateConditionGrade("item-1", "VG+");

		expect(result).toEqual({ success: true });
		expect(collectionChain.update).toHaveBeenCalled();
		// Verify the .eq chain was called (ownership check)
		expect(collectionChain.eq).toHaveBeenCalled();
	});

	test("rejects invalid grade value", async () => {
		const result = await updateConditionGrade("item-1", "Excellent");

		expect(result).toEqual({ error: "Invalid condition grade." });
	});

	test("rejects update on another user's item (IDOR prevention)", async () => {
		// The .eq("user_id", user.id) filter means update returns no rows
		const collectionChain = createChainedMock({ data: null, error: null });
		fromHandlers["collection_items"] = collectionChain;

		const result = await updateConditionGrade("someone-else-item", "VG+");

		expect(result).toEqual({ error: "Not found" });
	});

	test("returns error when database update fails", async () => {
		const collectionChain = createChainedMock({
			data: null,
			error: { message: "DB error" },
		});
		fromHandlers["collection_items"] = collectionChain;

		const result = await updateConditionGrade("item-1", "Mint");

		expect(result).toEqual({ error: "Could not update condition grade." });
	});

	test("returns error for unauthenticated user", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});

		const result = await updateConditionGrade("item-1", "VG+");
		expect(result).toHaveProperty("error");
		expect(result.error).toMatch(/not authenticated/i);
	});

	test("accepts all valid CONDITION_GRADES", async () => {
		const grades = ["Mint", "VG+", "VG", "G+", "G", "F", "P"];

		for (const grade of grades) {
			// Reset mocks for each iteration
			fromHandlers = {};
			const collectionChain = createChainedMock({ data: { id: "item-1" }, error: null });
			fromHandlers["collection_items"] = collectionChain;

			const result = await updateConditionGrade("item-1", grade);
			expect(result).toEqual({ success: true });
		}
	});
});
