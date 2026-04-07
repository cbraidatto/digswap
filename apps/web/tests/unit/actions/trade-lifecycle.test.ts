import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_REQUESTER = "req-11111-11111-11111-11111";
const USER_PROVIDER = "prov-2222-2222-2222-2222";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_PROVIDER };
let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	tradeRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

vi.mock("@/lib/entitlements", () => ({
	checkAndIncrementTradeCount: vi.fn(async () => ({
		allowed: true,
		tradesUsed: 1,
		tradesLimit: 5,
	})),
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

	return { db: chain };
});

vi.mock("@/lib/db/schema/trades", () => ({
	tradeRequests: {
		id: "id",
		requesterId: "requester_id",
		providerId: "provider_id",
		status: "status",
		releaseId: "release_id",
		offeringReleaseId: "offering_release_id",
		message: "message",
		updatedAt: "updated_at",
	},
	tradeReviews: {
		id: "id",
		tradeId: "trade_id",
		reviewerId: "reviewer_id",
		reviewedId: "reviewed_id",
		qualityRating: "quality_rating",
		comment: "comment",
	},
	tradeMessages: {
		id: "id",
		tradeId: "trade_id",
		senderId: "sender_id",
		kind: "kind",
		body: "body",
	},
}));

vi.mock("@/lib/db/schema/releases", () => ({
	releases: { id: "id" },
}));

const { acceptTradeAction, declineTradeAction, cancelTradeAction, submitTradeReviewAction } =
	await import("@/actions/trades");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function pendingTrade(overrides?: Record<string, unknown>) {
	return {
		id: TRADE_ID,
		requesterId: USER_REQUESTER,
		providerId: USER_PROVIDER,
		status: "pending",
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_PROVIDER };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("acceptTradeAction", () => {
	it("allows provider to accept a pending trade", async () => {
		// loadTradeForParticipant returns the trade row
		selectResults = [[pendingTrade()]];

		const result = await acceptTradeAction(TRADE_ID);
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await acceptTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects requester from accepting their own request", async () => {
		mockAuthUser = { id: USER_REQUESTER };
		selectResults = [[pendingTrade()]];

		const result = await acceptTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Only the recipient");
	});

	it("rejects accept on a non-pending trade", async () => {
		selectResults = [[pendingTrade({ status: "completed" })]];

		const result = await acceptTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot accept");
	});

	it("rejects invalid trade ID", async () => {
		const result = await acceptTradeAction("not-a-uuid");
		expect(result.success).toBe(false);
		expect(result.error).toContain("Invalid");
	});

	it("returns error when trade not found", async () => {
		selectResults = [[]];

		const result = await acceptTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});

describe("declineTradeAction", () => {
	it("allows provider to decline a pending trade", async () => {
		selectResults = [[pendingTrade()]];

		const result = await declineTradeAction(TRADE_ID);
		expect(result.success).toBe(true);
	});

	it("rejects requester from declining", async () => {
		mockAuthUser = { id: USER_REQUESTER };
		selectResults = [[pendingTrade()]];

		const result = await declineTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Only the recipient");
	});

	it("rejects decline on a completed trade", async () => {
		selectResults = [[pendingTrade({ status: "completed" })]];

		const result = await declineTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot decline");
	});
});

describe("cancelTradeAction", () => {
	it("allows either participant to cancel a pending trade (provider)", async () => {
		selectResults = [[pendingTrade()]];

		const result = await cancelTradeAction(TRADE_ID);
		expect(result.success).toBe(true);
	});

	it("allows requester to cancel a pending trade", async () => {
		mockAuthUser = { id: USER_REQUESTER };
		selectResults = [[pendingTrade()]];

		const result = await cancelTradeAction(TRADE_ID);
		expect(result.success).toBe(true);
	});

	it("rejects cancel on a completed trade", async () => {
		selectResults = [[pendingTrade({ status: "completed" })]];

		const result = await cancelTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot cancel");
	});

	it("rejects cancel on a declined trade", async () => {
		selectResults = [[pendingTrade({ status: "declined" })]];

		const result = await cancelTradeAction(TRADE_ID);
		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot cancel");
	});
});

describe("submitTradeReviewAction", () => {
	it("allows review submission for a completed trade", async () => {
		// loadTradeForParticipant returns completed trade
		selectResults = [
			[pendingTrade({ status: "completed" })],
			// Check for existing review returns empty
			[],
		];

		const result = await submitTradeReviewAction({
			tradeId: TRADE_ID,
			qualityRating: 4,
			comment: "Great trade!",
		});
		expect(result.success).toBe(true);
	});

	it("rejects review for a non-completed trade", async () => {
		selectResults = [[pendingTrade({ status: "pending" })]];

		const result = await submitTradeReviewAction({
			tradeId: TRADE_ID,
			qualityRating: 4,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("completed");
	});

	it("rejects invalid rating", async () => {
		const result = await submitTradeReviewAction({
			tradeId: TRADE_ID,
			qualityRating: 6,
		});
		expect(result.success).toBe(false);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await submitTradeReviewAction({
			tradeId: TRADE_ID,
			qualityRating: 4,
		});
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});
});
