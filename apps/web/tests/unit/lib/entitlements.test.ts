import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const USER_ID = "user-11111-11111-11111-11111";

let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

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
		values: vi.fn().mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
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
				returning: vi.fn().mockImplementation(() => ({
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
		})),
	}));

	return { db: chain };
});

vi.mock("@/lib/db/schema/subscriptions", () => ({
	subscriptions: {
		userId: "user_id",
		plan: "plan",
		status: "status",
		tradesMonthReset: "trades_month_reset",
		tradesThisMonth: "trades_this_month",
		updatedAt: "updated_at",
	},
}));

vi.mock("@/lib/stripe", () => ({
	// type-only re-export, no runtime value needed
}));

// Stub "server-only" so it doesn't throw in test env
vi.mock("server-only", () => ({}));

const {
	isPremium,
	FREE_TRADE_LIMIT,
	canInitiateTrade,
	checkAndIncrementTradeCount,
	getQuotaStatus,
} = await import("@/lib/entitlements");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function subscriptionRow(overrides?: Record<string, unknown>) {
	return {
		userId: USER_ID,
		plan: "free",
		status: "active",
		tradesMonthReset: new Date(),
		tradesThisMonth: 0,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("isPremium", () => {
	it("returns true for premium_monthly with active status", () => {
		expect(isPremium("premium_monthly", "active")).toBe(true);
	});

	it("returns true for premium_annual with trialing status", () => {
		expect(isPremium("premium_annual", "trialing")).toBe(true);
	});

	it("returns false for premium plan with canceled status", () => {
		expect(isPremium("premium_monthly", "canceled")).toBe(false);
	});

	it("returns false for free plan", () => {
		expect(isPremium("free", "active")).toBe(false);
	});

	it("returns true for premium plan with no status (backwards compat)", () => {
		expect(isPremium("premium_monthly")).toBe(true);
	});

	it("returns false for free plan with no status", () => {
		expect(isPremium("free")).toBe(false);
	});
});

describe("FREE_TRADE_LIMIT", () => {
	it("is defined as 5", () => {
		expect(FREE_TRADE_LIMIT).toBe(5);
	});
});

describe("canInitiateTrade", () => {
	it("allows premium users with no limit", async () => {
		// getUserSubscription -> readSubscriptionRow
		selectResults = [[subscriptionRow({ plan: "premium_monthly", status: "active" })]];

		const result = await canInitiateTrade(USER_ID);
		expect(result.allowed).toBe(true);
		expect(result.reason).toBe("no_limit");
		expect(result.tradesLimit).toBeNull();
	});

	it("allows free user under limit", async () => {
		selectResults = [[subscriptionRow({ plan: "free", tradesThisMonth: 2 })]];

		const result = await canInitiateTrade(USER_ID);
		expect(result.allowed).toBe(true);
		expect(result.reason).toBe("under_limit");
		expect(result.tradesUsed).toBe(2);
		expect(result.tradesLimit).toBe(FREE_TRADE_LIMIT);
	});

	it("rejects free user at limit", async () => {
		selectResults = [[subscriptionRow({ plan: "free", tradesThisMonth: 5 })]];

		const result = await canInitiateTrade(USER_ID);
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("limit_reached");
	});

	it("treats missing subscription as free", async () => {
		selectResults = [[]];

		const result = await canInitiateTrade(USER_ID);
		expect(result.allowed).toBe(true);
		expect(result.reason).toBe("under_limit");
		expect(result.tradesUsed).toBe(0);
	});
});

describe("checkAndIncrementTradeCount", () => {
	it("allows premium user without incrementing", async () => {
		// getUserSubscription -> readSubscriptionRow
		selectResults = [[subscriptionRow({ plan: "premium_annual", status: "active" })]];

		const result = await checkAndIncrementTradeCount(USER_ID);
		expect(result.allowed).toBe(true);
		expect(result.tradesLimit).toBeNull();
	});

	it("increments and allows free user under limit", async () => {
		// getUserSubscription -> readSubscriptionRow
		selectResults = [
			[subscriptionRow({ plan: "free", tradesThisMonth: 2 })],
			// atomic update returning
			[{ tradesThisMonth: 3 }],
		];

		const result = await checkAndIncrementTradeCount(USER_ID);
		expect(result.allowed).toBe(true);
		expect(result.tradesUsed).toBe(3);
		expect(result.tradesLimit).toBe(FREE_TRADE_LIMIT);
	});

	it("rejects when atomic increment finds limit reached", async () => {
		// getUserSubscription -> readSubscriptionRow
		selectResults = [
			[subscriptionRow({ plan: "free", tradesThisMonth: 5 })],
			// atomic update returning empty (limit reached)
			[],
		];

		const result = await checkAndIncrementTradeCount(USER_ID);
		expect(result.allowed).toBe(false);
		expect(result.tradesUsed).toBe(5);
	});
});

describe("getQuotaStatus", () => {
	it("returns premium status with no limit", async () => {
		selectResults = [[subscriptionRow({ plan: "premium_monthly", status: "active" })]];

		const result = await getQuotaStatus(USER_ID);
		expect(result.isPremium).toBe(true);
		expect(result.tradesLimit).toBeNull();
		expect(result.percentUsed).toBeNull();
		expect(result.plan).toBe("premium_monthly");
	});

	it("returns free user quota with percent", async () => {
		selectResults = [[subscriptionRow({ plan: "free", tradesThisMonth: 3 })]];

		const result = await getQuotaStatus(USER_ID);
		expect(result.isPremium).toBe(false);
		expect(result.tradesLimit).toBe(FREE_TRADE_LIMIT);
		expect(result.tradesUsed).toBe(3);
		expect(result.percentUsed).toBe(60);
	});

	it("caps percentUsed at 100", async () => {
		selectResults = [[subscriptionRow({ plan: "free", tradesThisMonth: 10 })]];

		const result = await getQuotaStatus(USER_ID);
		expect(result.percentUsed).toBe(100);
	});
});
