import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const TRADE_ID = "trade-1111-1111-1111-1111";
const USER_ID = "user-2222-2222-2222-2222";

let selectResults: unknown[][] = [];
let queryCallCount = 0;
const mockInsertValues = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

vi.mock("@/lib/env", () => ({
	env: {
		HANDOFF_HMAC_SECRET: "test-secret-key-for-hmac-operations-32chars",
	},
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit"];
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

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args) => args),
	eq: vi.fn((a, b) => ({ a, b })),
	isNull: vi.fn((a) => ({ a, op: "IS NULL" })),
}));

vi.mock("@/lib/db/schema/trades", () => ({
	handoffTokens: {
		id: "id",
		tradeId: "trade_id",
		userId: "user_id",
		tokenHmac: "token_hmac",
		expiresAt: "expires_at",
		usedAt: "used_at",
	},
}));

const { createHandoffToken, verifyAndConsumeHandoffToken } = await import(
	"@/lib/desktop/handoff-token"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("createHandoffToken", () => {
	it("returns a 64-character hex token", async () => {
		selectResults = [[{ id: "token-001" }]];

		const token = await createHandoffToken(TRADE_ID, USER_ID);
		expect(token).toMatch(/^[a-f0-9]{64}$/);
	});

	it("generates unique tokens on each call", async () => {
		selectResults = [[{ id: "token-001" }], [{ id: "token-002" }]];

		const token1 = await createHandoffToken(TRADE_ID, USER_ID);
		const token2 = await createHandoffToken(TRADE_ID, USER_ID);
		expect(token1).not.toBe(token2);
	});

	it("calls db.insert with correct values", async () => {
		selectResults = [[{ id: "token-001" }]];

		await createHandoffToken(TRADE_ID, USER_ID);
		expect(mockInsertValues).toHaveBeenCalledWith(
			expect.objectContaining({
				tradeId: TRADE_ID,
				userId: USER_ID,
				tokenHmac: expect.any(String),
				expiresAt: expect.any(Date),
			}),
		);
	});

	it("sets expiry ~30 seconds in the future", async () => {
		selectResults = [[{ id: "token-001" }]];
		const before = Date.now();

		await createHandoffToken(TRADE_ID, USER_ID);

		const call = mockInsertValues.mock.calls[0][0];
		const expiresMs = call.expiresAt.getTime();
		// Should be about 30 seconds from now
		expect(expiresMs - before).toBeGreaterThanOrEqual(29_000);
		expect(expiresMs - before).toBeLessThanOrEqual(31_000);
	});
});

describe("verifyAndConsumeHandoffToken", () => {
	it("returns true for valid unused non-expired token", async () => {
		const futureDate = new Date(Date.now() + 60_000);
		selectResults = [
			// First query: find matching token
			[{ id: "row-1", expiresAt: futureDate }],
			// Second query: update returns claimed row
			[{ id: "row-1" }],
		];

		const result = await verifyAndConsumeHandoffToken("a".repeat(64), TRADE_ID, USER_ID);
		expect(result).toBe(true);
	});

	it("returns false when no matching token found", async () => {
		selectResults = [[]];

		const result = await verifyAndConsumeHandoffToken("b".repeat(64), TRADE_ID, USER_ID);
		expect(result).toBe(false);
	});

	it("returns false when token is expired", async () => {
		const pastDate = new Date(Date.now() - 60_000);
		selectResults = [
			[{ id: "row-1", expiresAt: pastDate }],
		];

		const result = await verifyAndConsumeHandoffToken("c".repeat(64), TRADE_ID, USER_ID);
		expect(result).toBe(false);
	});

	it("returns false when concurrent replay wins (update returns empty)", async () => {
		const futureDate = new Date(Date.now() + 60_000);
		selectResults = [
			[{ id: "row-1", expiresAt: futureDate }],
			// Update returns empty (another request consumed it)
			[],
		];

		const result = await verifyAndConsumeHandoffToken("d".repeat(64), TRADE_ID, USER_ID);
		expect(result).toBe(false);
	});
});
