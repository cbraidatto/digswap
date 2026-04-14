import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-111111111111";
const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COUNTERPARTY_ID = "cpty-2222-2222-2222-222222222222";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let mockPresenceResult: unknown = null;
let mockPresenceError: Error | null = null;

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/validations/common", () => ({
	uuidSchema: {
		safeParse: vi.fn((value: unknown) => {
			if (
				typeof value === "string" &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
			) {
				return { success: true, data: value };
			}
			return { success: false };
		}),
	},
}));

const mockDeriveTradePresence = vi.fn();

vi.mock("@/lib/trades/presence", () => ({
	deriveTradePresence: mockDeriveTradePresence,
}));

const { getTradePresence } = await import("@/actions/trade-presence");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	mockPresenceError = null;
	mockPresenceResult = {
		tradeId: TRADE_ID,
		me: { isOnline: true, lastSeenAt: "2025-01-01T00:00:00Z", userId: USER_ID },
		counterparty: { isOnline: false, lastSeenAt: null, userId: COUNTERPARTY_ID },
		state: "me_only",
	};
	mockDeriveTradePresence.mockReset();
	mockDeriveTradePresence.mockImplementation(async () => {
		if (mockPresenceError) throw mockPresenceError;
		return mockPresenceResult;
	});
});

describe("getTradePresence", () => {
	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await getTradePresence(TRADE_ID);
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toBe("Failed to get trade presence.");
	});

	it("returns error for invalid trade ID", async () => {
		const result = await getTradePresence("not-a-uuid");
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toBe("Invalid trade.");
	});

	it("returns presence snapshot for valid request", async () => {
		const result = await getTradePresence(TRADE_ID);
		expect(result).toHaveProperty("tradeId", TRADE_ID);
		expect(result).toHaveProperty("state", "me_only");
		expect(result).toHaveProperty("me");
		expect(result).toHaveProperty("counterparty");
	});

	it("propagates error when deriveTradePresence throws", async () => {
		mockPresenceError = new Error("Trade not found");
		await expect(getTradePresence(TRADE_ID)).rejects.toThrow("Trade not found");
	});

	it("returns both_online state when both participants are online", async () => {
		mockPresenceResult = {
			tradeId: TRADE_ID,
			me: { isOnline: true, lastSeenAt: "2025-01-01T00:00:00Z", userId: USER_ID },
			counterparty: { isOnline: true, lastSeenAt: "2025-01-01T00:00:00Z", userId: COUNTERPARTY_ID },
			state: "both_online",
		};

		const result = await getTradePresence(TRADE_ID);
		expect(result).toHaveProperty("state", "both_online");
	});
});
