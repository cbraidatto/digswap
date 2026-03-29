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
const mockAdminAuth = {
	admin: { getUserById: vi.fn() },
};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
		rpc: mockRpc,
		auth: mockAdminAuth,
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
	TRADE_EXPIRY_HOURS: 24,
	MAX_FREE_TRADES_PER_MONTH: 5,
	isP2PEnabled: vi.fn().mockReturnValue(true),
}));

const mockGetTradeCountThisMonth = vi.fn();
vi.mock("@/lib/trades/queries", () => ({
	getTradeCountThisMonth: (...args: unknown[]) =>
		mockGetTradeCountThisMonth(...args),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { createTrade } from "@/actions/trades";
import { isP2PEnabled } from "@/lib/trades/constants";

describe("createTrade", () => {
	const validFormData = {
		providerId: "provider-1",
		releaseId: "release-1",
		offeringReleaseId: "offering-release-1",
		declaredQuality: "FLAC",
		conditionNotes: "Original pressing, clean copy, no pops or clicks",
		message: "Great record!",
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		// Default: P2P enabled
		vi.mocked(isP2PEnabled).mockReturnValue(true);
		// Default: ToS accepted
		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: "2026-01-01T00:00:00Z" },
				});
			}
			if (table === "trade_requests") {
				return createQueryChain({
					data: { id: "trade-1" },
				});
			}
			if (table === "notifications") {
				return createQueryChain({ error: null });
			}
			return createQueryChain({ data: null });
		});
		// Default: quota OK
		mockGetTradeCountThisMonth.mockResolvedValue({
			count: 2,
			resetDate: null,
			plan: "free",
		});
	});

	it("creates a trade request with valid data", async () => {
		const result = await createTrade(validFormData);

		expect(result.success).toBe(true);
		expect(result.tradeId).toBe("trade-1");
	});

	it("rejects when P2P is disabled", async () => {
		vi.mocked(isP2PEnabled).mockReturnValue(false);

		const result = await createTrade(validFormData);

		expect(result.error).toBe("P2P trading is currently disabled");
		expect(result.success).toBeUndefined();
	});

	it("rejects when ToS not accepted", async () => {
		mockFrom.mockImplementation((table: string) => {
			if (table === "profiles") {
				return createQueryChain({
					data: { trades_tos_accepted_at: null },
				});
			}
			return createQueryChain({ data: null });
		});

		const result = await createTrade(validFormData);

		expect(result.error).toBe("ToS not accepted");
	});

	it("rejects when trade quota reached", async () => {
		mockGetTradeCountThisMonth.mockResolvedValue({
			count: 5,
			resetDate: null,
			plan: "free",
		});

		const result = await createTrade(validFormData);

		expect(result.error).toBe("Trade quota reached");
		expect(result.tradesRemaining).toBe(0);
	});

	it("allows premium users unlimited trades", async () => {
		mockGetTradeCountThisMonth.mockResolvedValue({
			count: 50,
			resetDate: null,
			plan: "premium_monthly",
		});

		const result = await createTrade(validFormData);

		expect(result.success).toBe(true);
	});
});
