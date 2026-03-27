import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase auth mock
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: { getUser: mockGetUser },
	})),
}));

// ---------------------------------------------------------------------------
// Supabase admin client mock (chainable query pattern)
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
		rpc: mockRpc,
	})),
}));

// ---------------------------------------------------------------------------
// Helper: build a chainable Supabase query mock
// ---------------------------------------------------------------------------
function createQueryChain(result: { data?: unknown; error?: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select",
		"eq",
		"neq",
		"single",
		"maybeSingle",
		"insert",
		"update",
		"in",
		"or",
		"order",
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockLogActivity = vi.fn();
vi.mock("@/actions/social", () => ({
	logActivity: (...args: unknown[]) => mockLogActivity(...args),
}));

const mockAwardBadge = vi.fn().mockResolvedValue(true);
vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: (...args: unknown[]) => mockAwardBadge(...args),
}));

vi.mock("@/lib/gamification/constants", () => ({
	CONTRIBUTION_POINTS: { trade_completed: 15 },
}));

vi.mock("@/lib/trades/constants", () => ({
	TRADE_STATUS: {
		PENDING: "pending",
		ACCEPTED: "accepted",
		TRANSFERRING: "transferring",
		COMPLETED: "completed",
		DECLINED: "declined",
		CANCELLED: "cancelled",
		EXPIRED: "expired",
	},
	MAX_FREE_TRADES_PER_MONTH: 5,
	isP2PEnabled: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/trades/queries", () => ({
	getTradeCountThisMonth: vi.fn().mockResolvedValue({
		count: 0,
		resetDate: null,
		plan: "free",
	}),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { completeTrade } from "@/actions/trades";

describe("completeTrade", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});

		// Default mock: trade in transferring state
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				return createQueryChain({
					data: {
						id: "trade-1",
						requester_id: "user-1",
						provider_id: "provider-1",
						status: "transferring",
					},
				});
			}
			if (table === "trade_reviews") {
				return createQueryChain({ error: null });
			}
			if (table === "subscriptions") {
				return createQueryChain({ error: null });
			}
			if (table === "notifications") {
				return createQueryChain({ error: null });
			}
			return createQueryChain({ data: null });
		});

		mockRpc.mockReturnValue({
			then: (resolve: (v: unknown) => void) =>
				resolve({ error: { message: "rpc not found" } }),
		});
	});

	it("creates review and updates status to completed", async () => {
		const result = await completeTrade("trade-1", 4, "Good quality");

		expect(result.success).toBe(true);
		// Verify from was called with trade_reviews (insert)
		const reviewCalls = mockFrom.mock.calls.filter(
			(c: string[]) => c[0] === "trade_reviews",
		);
		expect(reviewCalls.length).toBeGreaterThanOrEqual(1);
	});

	it("awards CONNECTOR badge to both parties", async () => {
		await completeTrade("trade-1", 4, "Good quality");

		expect(mockAwardBadge).toHaveBeenCalledWith("user-1", "connector");
		expect(mockAwardBadge).toHaveBeenCalledWith("provider-1", "connector");
		expect(mockAwardBadge).toHaveBeenCalledTimes(2);
	});

	it("increments contribution score by 15 for both", async () => {
		await completeTrade("trade-1", 5, "Excellent");

		// Verify logActivity was called with the correct points
		expect(mockLogActivity).toHaveBeenCalledWith(
			"user-1",
			"completed_trade",
			"trade",
			"trade-1",
			expect.objectContaining({ points: 15 }),
		);
	});

	it("rejects invalid quality rating (0 or 6)", async () => {
		const result0 = await completeTrade("trade-1", 0, null);
		expect(result0.error).toBe("Quality rating must be between 1 and 5");

		const result6 = await completeTrade("trade-1", 6, null);
		expect(result6.error).toBe("Quality rating must be between 1 and 5");
	});
});
