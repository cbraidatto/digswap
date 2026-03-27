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
import { getTradeReputation } from "@/lib/trades/queries";

describe("getTradeReputation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns average rating from trade reviews", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_reviews") {
				return createQueryChain({
					data: [
						{ quality_rating: 4 },
						{ quality_rating: 5 },
						{ quality_rating: 3 },
					],
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeReputation("user-1");

		expect(result.totalTrades).toBe(3);
		expect(result.averageRating).toBe(4);
	});

	it("returns null average when no reviews exist", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_reviews") {
				return createQueryChain({ data: [] });
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeReputation("user-1");

		expect(result.totalTrades).toBe(0);
		expect(result.averageRating).toBeNull();
	});

	it("returns correct totalTrades count", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "trade_reviews") {
				return createQueryChain({
					data: [
						{ quality_rating: 5 },
						{ quality_rating: 4 },
						{ quality_rating: 5 },
						{ quality_rating: 3 },
						{ quality_rating: 4 },
					],
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await getTradeReputation("user-1");

		expect(result.totalTrades).toBe(5);
		expect(result.averageRating).toBe(4.2);
	});
});
