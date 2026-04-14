import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const USER_ME = "user-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const USER_THEM = "user-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

let mockRpcResult: { data: unknown[] | null; error: { message: string } | null } = {
	data: [],
	error: null,
};

let mockParticipantContext: {
	counterpartyId: string;
	tradeId: string;
	isRequester: boolean;
} | null = {
	counterpartyId: USER_THEM,
	tradeId: TRADE_ID,
	isRequester: true,
};

vi.mock("@/lib/trades/messages", () => ({
	getTradeParticipantContext: vi.fn(async () => mockParticipantContext),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		rpc: vi.fn(async () => mockRpcResult),
	})),
}));

const { deriveTradePresence } = await import("@/lib/trades/presence");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockParticipantContext = {
		counterpartyId: USER_THEM,
		tradeId: TRADE_ID,
		isRequester: true,
	};
	mockRpcResult = { data: [], error: null };
	vi.clearAllMocks();
});

describe("deriveTradePresence", () => {
	it("returns 'both_online' when both participants are active", async () => {
		mockRpcResult = {
			data: [
				{ user_id: USER_ME, is_active: true, last_heartbeat_at: "2024-06-01T12:00:00Z" },
				{ user_id: USER_THEM, is_active: true, last_heartbeat_at: "2024-06-01T12:00:00Z" },
			],
			error: null,
		};

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("both_online");
		expect(result.me.isOnline).toBe(true);
		expect(result.counterparty.isOnline).toBe(true);
		expect(result.tradeId).toBe(TRADE_ID);
	});

	it("returns 'me_only' when only I am online", async () => {
		mockRpcResult = {
			data: [
				{ user_id: USER_ME, is_active: true, last_heartbeat_at: "2024-06-01T12:00:00Z" },
				{ user_id: USER_THEM, is_active: false, last_heartbeat_at: "2024-06-01T11:00:00Z" },
			],
			error: null,
		};

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("me_only");
		expect(result.me.isOnline).toBe(true);
		expect(result.counterparty.isOnline).toBe(false);
	});

	it("returns 'counterparty_only' when only they are online", async () => {
		mockRpcResult = {
			data: [
				{ user_id: USER_ME, is_active: false, last_heartbeat_at: null },
				{ user_id: USER_THEM, is_active: true, last_heartbeat_at: "2024-06-01T12:00:00Z" },
			],
			error: null,
		};

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("counterparty_only");
	});

	it("returns 'neither' when both are offline", async () => {
		mockRpcResult = {
			data: [
				{ user_id: USER_ME, is_active: false, last_heartbeat_at: null },
				{ user_id: USER_THEM, is_active: false, last_heartbeat_at: null },
			],
			error: null,
		};

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("neither");
		expect(result.me.isOnline).toBe(false);
		expect(result.counterparty.isOnline).toBe(false);
	});

	it("returns 'neither' when rpc returns empty data", async () => {
		mockRpcResult = { data: [], error: null };

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("neither");
		expect(result.me.lastSeenAt).toBeNull();
		expect(result.counterparty.lastSeenAt).toBeNull();
	});

	it("returns 'neither' when rpc returns null data", async () => {
		mockRpcResult = { data: null, error: null };

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.state).toBe("neither");
	});

	it("throws when trade not found", async () => {
		mockParticipantContext = null;

		await expect(deriveTradePresence(TRADE_ID, USER_ME)).rejects.toThrow(
			"Trade not found or forbidden.",
		);
	});

	it("throws when rpc returns an error", async () => {
		mockRpcResult = { data: null, error: { message: "RPC failed" } };

		await expect(deriveTradePresence(TRADE_ID, USER_ME)).rejects.toThrow(
			"Failed to fetch trade presence: RPC failed",
		);
	});

	it("normalizes lastSeenAt to ISO string", async () => {
		mockRpcResult = {
			data: [
				{ user_id: USER_ME, is_active: true, last_heartbeat_at: "2024-06-01T12:34:56Z" },
			],
			error: null,
		};

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.me.lastSeenAt).toBe(new Date("2024-06-01T12:34:56Z").toISOString());
	});

	it("sets correct userId on me and counterparty", async () => {
		mockRpcResult = { data: [], error: null };

		const result = await deriveTradePresence(TRADE_ID, USER_ME);
		expect(result.me.userId).toBe(USER_ME);
		expect(result.counterparty.userId).toBe(USER_THEM);
	});
});
