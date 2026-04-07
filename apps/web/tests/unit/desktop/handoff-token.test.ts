import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------

// Track calls for assertions
const insertValuesMock = vi.fn();
const insertReturningMock = vi.fn();
const updateSetMock = vi.fn();
const updateWhereMock = vi.fn();
const updateReturningMock = vi.fn();
const _selectFromMock = vi.fn();
const _selectWhereMock = vi.fn();

// Queued results for sequential DB calls
let dbResults: unknown[] = [];
let dbCallIndex = 0;

function nextResult(): unknown {
	const r = dbResults[dbCallIndex] ?? [];
	dbCallIndex++;
	return r;
}

vi.mock("@/lib/db", () => {
	// Minimal chainable select mock — resolves with next result
	const selectChain = {
		from: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		then: (resolve: (v: unknown) => void) => resolve(nextResult()),
	};
	selectChain.from.mockReturnValue(selectChain);
	selectChain.where.mockReturnValue(selectChain);

	// Update chain: update().set().where().returning() -> resolves
	const updateReturning = {
		then: (resolve: (v: unknown) => void) => resolve(nextResult()),
	};
	updateReturningMock.mockReturnValue(updateReturning);
	const updateWhere = { returning: updateReturningMock };
	updateWhereMock.mockReturnValue(updateWhere);
	const updateSet = { where: updateWhereMock };
	updateSetMock.mockReturnValue(updateSet);
	const updateChain = { set: updateSetMock };

	// Insert chain: insert().values().returning() -> resolves
	const insertReturning = {
		then: (resolve: (v: unknown) => void) => resolve(nextResult()),
	};
	insertReturningMock.mockReturnValue(insertReturning);
	insertValuesMock.mockReturnValue({ returning: insertReturningMock });
	const insertChain = { values: insertValuesMock };

	return {
		db: {
			select: vi.fn().mockReturnValue(selectChain),
			insert: vi.fn().mockReturnValue(insertChain),
			update: vi.fn().mockReturnValue(updateChain),
		},
	};
});

vi.mock("@/lib/db/schema/trades", () => ({
	handoffTokens: {
		id: "id",
		tradeId: "trade_id",
		userId: "user_id",
		tokenHmac: "token_hmac",
		expiresAt: "expires_at",
		usedAt: "used_at",
		createdAt: "created_at",
	},
}));

// Set env before importing module under test
vi.stubEnv("HANDOFF_HMAC_SECRET", "test-secret-at-least-32-bytes-long!!");

// Import after mocks are registered
const { createHandoffToken, verifyAndConsumeHandoffToken } = await import(
	"@/lib/desktop/handoff-token"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reset DB call queue before each test */
beforeEach(() => {
	dbResults = [];
	dbCallIndex = 0;
	vi.clearAllMocks();

	// Re-wire mocks after clearAllMocks (clearAllMocks clears call history, not implementation)
	// Implementation stubs are preserved because vi.mock() factories are hoisted
});

describe("createHandoffToken", () => {
	it("returns a 64-character hex token (32 bytes)", async () => {
		// DB insert returns the inserted row id
		dbResults = [[{ id: "row-uuid" }]];

		const token = await createHandoffToken("trade-1", "user-1");

		expect(token).toMatch(/^[0-9a-f]{64}$/);
	});
});

describe("verifyAndConsumeHandoffToken", () => {
	it("returns true for a valid unused non-expired token", async () => {
		// Build a real token to verify against
		const { createHmac } = await import("node:crypto");
		const plaintext = "a".repeat(64); // deterministic for test
		const hmac = createHmac("sha256", "test-secret-at-least-32-bytes-long!!")
			.update(plaintext)
			.digest("hex");

		const futureExpiry = new Date(Date.now() + 300_000);

		// First DB result: SELECT returns matching row
		dbResults = [
			[
				{
					id: "row-1",
					tradeId: "trade-1",
					userId: "user-1",
					tokenHmac: hmac,
					expiresAt: futureExpiry,
					usedAt: null,
				},
			],
			// Second DB result: UPDATE returning — 1 row updated
			[{ id: "row-1" }],
		];

		const result = await verifyAndConsumeHandoffToken(plaintext, "trade-1", "user-1");

		expect(result).toBe(true);
	});

	it("returns false on second consumption (replay attack blocked)", async () => {
		const { createHmac } = await import("node:crypto");
		const plaintext = "b".repeat(64);
		const hmac = createHmac("sha256", "test-secret-at-least-32-bytes-long!!")
			.update(plaintext)
			.digest("hex");

		const futureExpiry = new Date(Date.now() + 300_000);

		// First call: SELECT finds row, UPDATE succeeds (1 row)
		dbResults = [
			[
				{
					id: "row-2",
					tradeId: "trade-2",
					userId: "user-2",
					tokenHmac: hmac,
					expiresAt: futureExpiry,
					usedAt: null,
				},
			],
			[{ id: "row-2" }], // update returning
			// Second call: SELECT finds nothing (usedAt IS NULL filter eliminates consumed row)
			[],
			[], // update returning (not reached, but safe)
		];

		const first = await verifyAndConsumeHandoffToken(plaintext, "trade-2", "user-2");
		expect(first).toBe(true);

		const second = await verifyAndConsumeHandoffToken(plaintext, "trade-2", "user-2");
		expect(second).toBe(false);
	});

	it("returns false for an expired token", async () => {
		const { createHmac } = await import("node:crypto");
		const plaintext = "c".repeat(64);
		const hmac = createHmac("sha256", "test-secret-at-least-32-bytes-long!!")
			.update(plaintext)
			.digest("hex");

		const pastExpiry = new Date(Date.now() - 1000); // already expired

		// SELECT returns the row (usedAt IS NULL) but expiresAt is in the past
		dbResults = [
			[
				{
					id: "row-3",
					tradeId: "trade-3",
					userId: "user-3",
					tokenHmac: hmac,
					expiresAt: pastExpiry,
					usedAt: null,
				},
			],
		];

		const result = await verifyAndConsumeHandoffToken(plaintext, "trade-3", "user-3");

		expect(result).toBe(false);
	});

	it("returns false for wrong tradeId", async () => {
		// SELECT returns empty (WHERE clause filters out mismatched tradeId)
		dbResults = [[]];

		const result = await verifyAndConsumeHandoffToken("any-token", "wrong-trade", "user-1");

		expect(result).toBe(false);
	});
});
