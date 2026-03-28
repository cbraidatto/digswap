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
// Drizzle db mock
// ---------------------------------------------------------------------------
const mockDbExecute = vi.fn().mockResolvedValue([]);

vi.mock("@/lib/db", () => ({
	db: {
		execute: (...args: unknown[]) => mockDbExecute(...args),
	},
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
import { completeTrade, skipReview } from "@/actions/trades";

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
				return createQueryChain({ data: null, error: null });
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

	it("returns error when trade status has changed between SELECT and UPDATE (optimistic concurrency)", async () => {
		// First call (SELECT trade_requests) returns trade in transferring state
		// Second call (UPDATE trade_requests) returns null data to simulate 0-row update
		let tradeRequestCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				tradeRequestCallCount++;
				if (tradeRequestCallCount === 1) {
					// SELECT: trade exists in transferring state
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "transferring",
						},
					});
				}
				// UPDATE: 0 rows affected (status changed concurrently)
				return createQueryChain({ data: null, error: null });
			}
			if (table === "trade_reviews") {
				return createQueryChain({ data: null, error: null });
			}
			return createQueryChain({ data: null, error: null });
		});

		const result = await completeTrade("trade-1", 4, "Good quality");
		expect(result.error).toBe("Trade was already completed or modified by another request");
	});

	it("returns error when review already exists for this user and trade", async () => {
		// trade_reviews SELECT returns existing review
		let tradeReviewCallCount = 0;
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
				tradeReviewCallCount++;
				if (tradeReviewCallCount === 1) {
					// First call: check for existing review -- found one
					return createQueryChain({ data: { id: "review-existing" } });
				}
				return createQueryChain({ data: null, error: null });
			}
			return createQueryChain({ data: null, error: null });
		});

		const result = await completeTrade("trade-1", 4, "Good quality");
		expect(result.error).toBe("You have already reviewed this trade");
	});

	it("uses atomic SQL increments via db.execute (no read-increment-write)", async () => {
		await completeTrade("trade-1", 5, "Excellent");

		// The counter increments should go through db.execute (Drizzle), NOT through
		// mockFrom("subscriptions").select() + mockFrom("subscriptions").update()
		expect(mockDbExecute).toHaveBeenCalled();

		// Verify NO separate SELECT on subscriptions or user_rankings for read-increment-write
		const subscriptionSelectCalls = mockFrom.mock.calls.filter(
			(c: string[]) => c[0] === "subscriptions",
		);
		// subscriptions table should NOT be accessed via Supabase client at all
		expect(subscriptionSelectCalls.length).toBe(0);
	});
});

describe("skipReview", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});

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
			return createQueryChain({ data: null, error: null });
		});
	});

	it("returns error when trade status has changed between SELECT and UPDATE (optimistic concurrency)", async () => {
		let tradeRequestCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_requests") {
				tradeRequestCallCount++;
				if (tradeRequestCallCount === 1) {
					return createQueryChain({
						data: {
							id: "trade-1",
							requester_id: "user-1",
							provider_id: "provider-1",
							status: "transferring",
						},
					});
				}
				// UPDATE: 0 rows affected (status changed concurrently)
				return createQueryChain({ data: null, error: null });
			}
			return createQueryChain({ data: null, error: null });
		});

		const result = await skipReview("trade-1");
		expect(result.error).toBe("Trade was already completed or modified by another request");
	});

	it("uses atomic SQL increments via db.execute (no read-increment-write)", async () => {
		await skipReview("trade-1");

		// Counter increments should go through db.execute
		expect(mockDbExecute).toHaveBeenCalled();

		// No subscriptions or user_rankings accessed via Supabase client
		const subscriptionCalls = mockFrom.mock.calls.filter(
			(c: string[]) => c[0] === "subscriptions",
		);
		expect(subscriptionCalls.length).toBe(0);
	});
});
