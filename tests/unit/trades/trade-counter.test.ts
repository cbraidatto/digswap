import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Supabase admin client mock (chainable query pattern)
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
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
// Import after mocks
// ---------------------------------------------------------------------------
import { getTradeCountThisMonth } from "@/lib/trades/queries";

describe("getTradeCountThisMonth", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns current count for same month", async () => {
		// Reset date is current month
		const now = new Date();
		const resetDate = new Date(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			1,
		).toISOString();

		mockFrom.mockImplementation((table: string) => {
			if (table === "subscriptions") {
				return createQueryChain({
					data: {
						trades_this_month: 3,
						trades_month_reset: resetDate,
						plan: "free",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeCountThisMonth("user-1");

		expect(result.count).toBe(3);
		expect(result.plan).toBe("free");
	});

	it("resets count when month has rolled over", async () => {
		// Reset date is previous month
		const lastMonth = new Date();
		lastMonth.setUTCMonth(lastMonth.getUTCMonth() - 1);
		const resetDate = lastMonth.toISOString();

		// Track update calls
		let updateCalled = false;
		const subscriptionChain: Record<string, unknown> = {};
		const methods = [
			"select",
			"eq",
			"neq",
			"single",
			"maybeSingle",
			"in",
			"or",
			"order",
		];
		for (const method of methods) {
			subscriptionChain[method] = vi
				.fn()
				.mockReturnValue(subscriptionChain);
		}
		subscriptionChain.update = vi.fn().mockImplementation(() => {
			updateCalled = true;
			return subscriptionChain;
		});
		subscriptionChain.then = (resolve: (v: unknown) => void) =>
			resolve({
				data: {
					trades_this_month: 7,
					trades_month_reset: resetDate,
					plan: "free",
				},
			});

		mockFrom.mockImplementation((table: string) => {
			if (table === "subscriptions") {
				return subscriptionChain;
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeCountThisMonth("user-1");

		// Should have reset to 0
		expect(result.count).toBe(0);
		expect(updateCalled).toBe(true);
	});

	it("returns Infinity remaining for premium users", async () => {
		const now = new Date();
		const resetDate = new Date(
			now.getUTCFullYear(),
			now.getUTCMonth(),
			1,
		).toISOString();

		mockFrom.mockImplementation((table: string) => {
			if (table === "subscriptions") {
				return createQueryChain({
					data: {
						trades_this_month: 50,
						trades_month_reset: resetDate,
						plan: "premium_monthly",
					},
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeCountThisMonth("user-1");

		// Premium users have unlimited trades -- plan is premium_monthly
		expect(result.plan).toBe("premium_monthly");
		expect(result.count).toBe(50);
	});
});
