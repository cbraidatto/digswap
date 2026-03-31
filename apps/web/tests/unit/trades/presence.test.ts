import { beforeEach, describe, expect, it, vi } from "vitest";

const TRADE_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const COUNTERPARTY_ID = "33333333-3333-4333-8333-333333333333";

let rpcData: unknown[] = [];
let rpcError: { message: string } | null = null;

const createClientMock = vi.fn(async () => ({
	rpc: vi.fn(async () => ({
		data: rpcData,
		error: rpcError,
	})),
}));

const getTradeParticipantContextMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: createClientMock,
}));

vi.mock("@/lib/trades/messages", () => ({
	getTradeParticipantContext: getTradeParticipantContextMock,
}));

const { deriveTradePresence } = await import("@/lib/trades/presence");

beforeEach(() => {
	rpcData = [];
	rpcError = null;
	vi.clearAllMocks();
	getTradeParticipantContextMock.mockResolvedValue({
		counterpartyId: COUNTERPARTY_ID,
		tradeId: TRADE_ID,
	});
});

describe("deriveTradePresence", () => {
	it("returns both_online when both participants have active sessions", async () => {
		rpcData = [
			{
				is_active: true,
				last_heartbeat_at: "2026-03-31T12:00:00.000Z",
				user_id: USER_ID,
			},
			{
				is_active: true,
				last_heartbeat_at: "2026-03-31T12:00:10.000Z",
				user_id: COUNTERPARTY_ID,
			},
		];

		const result = await deriveTradePresence(TRADE_ID, USER_ID);

		expect(result.state).toBe("both_online");
		expect(result.me.isOnline).toBe(true);
		expect(result.counterparty.isOnline).toBe(true);
	});

	it("returns me_only when only the caller has an active session", async () => {
		rpcData = [
			{
				is_active: true,
				last_heartbeat_at: "2026-03-31T12:00:00.000Z",
				user_id: USER_ID,
			},
			{
				is_active: false,
				last_heartbeat_at: null,
				user_id: COUNTERPARTY_ID,
			},
		];

		const result = await deriveTradePresence(TRADE_ID, USER_ID);

		expect(result.state).toBe("me_only");
	});

	it("returns counterparty_only when only the counterparty has an active session", async () => {
		rpcData = [
			{
				is_active: false,
				last_heartbeat_at: null,
				user_id: USER_ID,
			},
			{
				is_active: true,
				last_heartbeat_at: "2026-03-31T12:00:10.000Z",
				user_id: COUNTERPARTY_ID,
			},
		];

		const result = await deriveTradePresence(TRADE_ID, USER_ID);

		expect(result.state).toBe("counterparty_only");
	});

	it("returns neither when no active sessions exist", async () => {
		rpcData = [
			{
				is_active: false,
				last_heartbeat_at: null,
				user_id: USER_ID,
			},
			{
				is_active: false,
				last_heartbeat_at: null,
				user_id: COUNTERPARTY_ID,
			},
		];

		const result = await deriveTradePresence(TRADE_ID, USER_ID);

		expect(result.state).toBe("neither");
		expect(result.me.isOnline).toBe(false);
		expect(result.counterparty.isOnline).toBe(false);
	});

	it("treats stale sessions as inactive when the RPC marks them inactive", async () => {
		rpcData = [
			{
				is_active: false,
				last_heartbeat_at: "2026-03-31T11:30:00.000Z",
				user_id: USER_ID,
			},
			{
				is_active: false,
				last_heartbeat_at: "2026-03-31T11:29:00.000Z",
				user_id: COUNTERPARTY_ID,
			},
		];

		const result = await deriveTradePresence(TRADE_ID, USER_ID);

		expect(result.state).toBe("neither");
		expect(result.me.lastSeenAt).toBe("2026-03-31T11:30:00.000Z");
		expect(result.counterparty.lastSeenAt).toBe("2026-03-31T11:29:00.000Z");
	});
});
