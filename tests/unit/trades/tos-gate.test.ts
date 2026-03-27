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
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock("@/actions/social", () => ({
	logActivity: vi.fn(),
}));

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn().mockResolvedValue(true),
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
import { acceptToS } from "@/actions/trades";

describe("acceptToS", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sets trades_tos_accepted_at to current timestamp", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});

		// Capture update payload
		let updatePayload: unknown = null;
		const updateChain: Record<string, unknown> = {};
		updateChain.update = vi.fn().mockImplementation((payload: unknown) => {
			updatePayload = payload;
			return updateChain;
		});
		updateChain.eq = vi.fn().mockReturnValue(updateChain);
		updateChain.select = vi.fn().mockReturnValue(updateChain);
		updateChain.single = vi.fn().mockReturnValue(updateChain);
		updateChain.then = (resolve: (v: unknown) => void) =>
			resolve({ error: null });

		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") return updateChain;
			return createQueryChain({ data: null });
		});

		const result = await acceptToS();

		expect(result.success).toBe(true);
		expect(updatePayload).toHaveProperty("trades_tos_accepted_at");
		expect(
			typeof (updatePayload as Record<string, unknown>)
				.trades_tos_accepted_at,
		).toBe("string");
	});

	it("returns error when not authenticated", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});

		await expect(acceptToS()).rejects.toThrow("Not authenticated");
	});
});
