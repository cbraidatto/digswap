import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

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
// Supabase admin client mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(),
	})),
}));

// ---------------------------------------------------------------------------
// Mock remaining dependencies
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
import { getTurnCredentials } from "@/actions/trades";

describe("getTurnCredentials", () => {
	const originalEnv = process.env;

	beforeEach(() => {
		vi.clearAllMocks();
		process.env = { ...originalEnv };
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
	});

	afterAll(() => {
		process.env = originalEnv;
	});

	it("fetches ICE servers from Metered.ca API", async () => {
		process.env.METERED_APP_NAME = "testapp";
		process.env.METERED_API_KEY = "test-api-key";

		const mockIceServers = [
			{
				urls: "stun:stun.metered.ca:3478",
				username: "test",
				credential: "test-cred",
			},
		];

		global.fetch = vi.fn().mockResolvedValue({
			ok: true,
			json: () => Promise.resolve(mockIceServers),
		}) as unknown as typeof fetch;

		const result = await getTurnCredentials();

		expect(result).toEqual(mockIceServers);
		expect(fetch).toHaveBeenCalledWith(
			"https://testapp.metered.live/api/v1/turn/credentials?apiKey=test-api-key",
		);
	});

	it("falls back to STUN when env vars missing", async () => {
		delete process.env.METERED_APP_NAME;
		delete process.env.METERED_API_KEY;

		const result = await getTurnCredentials();

		expect(result).toEqual([
			{ urls: "stun:stun.l.google.com:19302" },
			{ urls: "stun:stun1.l.google.com:19302" },
		]);
	});

	it("throws on API failure", async () => {
		process.env.METERED_APP_NAME = "testapp";
		process.env.METERED_API_KEY = "test-api-key";

		global.fetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
		}) as unknown as typeof fetch;

		await expect(getTurnCredentials()).rejects.toThrow(
			"Failed to fetch TURN credentials: 500",
		);
	});
});
