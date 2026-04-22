import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const TRADE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PROPOSAL_ITEM_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_REQUESTER = "req-11111-11111-11111-11111";
const USER_PROVIDER = "prov-2222-2222-2222-2222";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_REQUESTER };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	tradeRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

const mockFunctionsInvoke = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
		functions: {
			invoke: mockFunctionsInvoke,
		},
	})),
}));

const mockCreateHandoffToken = vi.fn(async (..._args: unknown[]) => "signed-token-abc");

vi.mock("@/lib/desktop/handoff-token", () => ({
	createHandoffToken: (...args: unknown[]) => mockCreateHandoffToken(...args),
}));

vi.mock("@/lib/desktop/version", () => ({
	MIN_DESKTOP_VERSION: "0.2.0",
	TRADE_PROTOCOL_VERSION: 1,
}));

vi.mock("@/lib/env", () => ({
	publicEnv: {
		NEXT_PUBLIC_MIN_DESKTOP_VERSION: "0.3.0",
	},
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}

	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});

vi.mock("@/lib/db/schema/trades", () => ({
	tradeRequests: {
		id: "id",
		requesterId: "requester_id",
		providerId: "provider_id",
		status: "status",
	},
}));

vi.mock("@/lib/validations/common", async () => {
	const { z } = await import("zod");
	return { uuidSchema: z.string().uuid("Invalid identifier") };
});

const { generateHandoffToken, checkDesktopVersion, validatePreviewAction } = await import(
	"@/actions/desktop"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tradeRow(overrides?: Record<string, unknown>) {
	return {
		id: TRADE_ID,
		requesterId: USER_REQUESTER,
		providerId: USER_PROVIDER,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_REQUESTER };
	selectResults = [];
	queryCallCount = 0;
	mockFunctionsInvoke.mockReset();
	mockCreateHandoffToken.mockReset().mockResolvedValue("signed-token-abc");
	vi.clearAllMocks();
});

// ---- generateHandoffToken ------------------------------------------------

describe("generateHandoffToken", () => {
	it("returns token when caller is a trade participant", async () => {
		selectResults = [[tradeRow()]];

		const result = await generateHandoffToken(TRADE_ID);
		expect(result).toEqual({ token: "signed-token-abc" });
		expect(mockCreateHandoffToken).toHaveBeenCalledWith(TRADE_ID, USER_REQUESTER);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await generateHandoffToken(TRADE_ID);
		expect(result).toHaveProperty("error");
	});

	it("rejects invalid trade ID (not UUID)", async () => {
		const result = await generateHandoffToken("not-a-uuid");
		expect(result).toEqual({ error: "Invalid trade ID" });
	});

	it("returns IDOR error when caller is not a participant", async () => {
		// DB returns empty — user is not requester or provider
		selectResults = [[]];

		const result = await generateHandoffToken(TRADE_ID);
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("not a participant");
	});

	it("returns error when createHandoffToken throws", async () => {
		selectResults = [[tradeRow()]];
		mockCreateHandoffToken.mockRejectedValueOnce(new Error("HMAC failure"));

		const result = await generateHandoffToken(TRADE_ID);
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Failed");
	});
});

// ---- checkDesktopVersion -------------------------------------------------

describe("checkDesktopVersion", () => {
	it("returns version info without authentication", async () => {
		mockAuthUser = null; // no auth needed
		const result = await checkDesktopVersion();
		expect(result).toHaveProperty("minVersion");
		expect(result).toHaveProperty("tradeProtocolVersion");
		expect(typeof result.minVersion).toBe("string");
		expect(typeof result.tradeProtocolVersion).toBe("number");
	});

	it("reads NEXT_PUBLIC_MIN_DESKTOP_VERSION from env", async () => {
		const result = await checkDesktopVersion();
		expect(result.minVersion).toBe("0.3.0");
	});

	it("returns default version on fallback", async () => {
		// tradeProtocolVersion should be the constant
		const result = await checkDesktopVersion();
		expect(result.tradeProtocolVersion).toBe(1);
	});
});

// ---- validatePreviewAction -----------------------------------------------

describe("validatePreviewAction", () => {
	it("returns validation result from Supabase function", async () => {
		mockFunctionsInvoke.mockResolvedValueOnce({
			data: { valid: true, errors: [] },
			error: null,
		});

		const result = await validatePreviewAction(TRADE_ID, PROPOSAL_ITEM_ID);
		expect(result).toEqual({ valid: true, errors: [] });
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await validatePreviewAction(TRADE_ID, PROPOSAL_ITEM_ID);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("rejects invalid trade ID", async () => {
		const result = await validatePreviewAction("not-valid", PROPOSAL_ITEM_ID);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Invalid trade or proposal item ID.");
	});

	it("rejects invalid proposal item ID", async () => {
		const result = await validatePreviewAction(TRADE_ID, "not-valid");
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Invalid trade or proposal item ID.");
	});

	it("handles Supabase function error gracefully", async () => {
		mockFunctionsInvoke.mockResolvedValueOnce({
			data: null,
			error: new Error("Function failed"),
		});

		const result = await validatePreviewAction(TRADE_ID, PROPOSAL_ITEM_ID);
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});

	it("handles malformed Supabase function response", async () => {
		mockFunctionsInvoke.mockResolvedValueOnce({
			data: { unexpected: "shape" },
			error: null,
		});

		const result = await validatePreviewAction(TRADE_ID, PROPOSAL_ITEM_ID);
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("Preview validation returned an invalid response.");
	});
});
