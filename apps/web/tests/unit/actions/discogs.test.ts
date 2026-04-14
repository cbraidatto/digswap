import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let mockRateLimitSuccess = true;

// Supabase admin chain mock for from().select/insert/update/delete
const mockAdminFrom = vi.fn();

function createAdminChain(returnData: unknown = null, returnError: unknown = null) {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "eq", "in", "limit", "delete", "single", "update"];
	for (const m of methods) {
		chain[m] = vi.fn().mockReturnValue(chain);
	}
	chain.insert = vi.fn().mockReturnValue(chain);
	// Terminal — returns { data, error }
	chain.data = returnData;
	chain.error = returnError;
	// Make it thenable for await
	chain.then = (resolve: (v: unknown) => void) => resolve({ data: returnData, error: returnError });
	return chain;
}

let adminChainResults: Array<{ data: unknown; error: unknown }> = [];
let adminCallCount = 0;

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
			})),
		},
	})),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => {
		return {
			from: vi.fn().mockImplementation(() => {
				const entry = adminChainResults[adminCallCount] ?? { data: null, error: null };
				adminCallCount++;
				const chain: Record<string, unknown> = {};
				const methods = [
					"select",
					"eq",
					"in",
					"limit",
					"delete",
					"update",
					"insert",
					"single",
				];
				for (const m of methods) {
					chain[m] = vi.fn().mockReturnValue(chain);
				}
				// Make the chain await-able
				chain.then = (resolve: (v: unknown) => void) =>
					resolve({ data: entry.data, error: entry.error });
				return chain;
			}),
		};
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	discogsRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: mockRateLimitSuccess })),
}));

vi.mock("@/lib/env", () => ({
	env: {
		NODE_ENV: "test",
		IMPORT_WORKER_SECRET: "test-secret",
	},
	publicEnv: {
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));

const mockGetRequestToken = vi.fn();
const mockDeleteTokens = vi.fn();

vi.mock("@/lib/discogs/oauth", () => ({
	getRequestToken: (...args: unknown[]) => mockGetRequestToken(...args),
	deleteTokens: (...args: unknown[]) => mockDeleteTokens(...args),
}));

// Mock cookies
const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		set: mockCookieSet,
	})),
}));

// Mock global fetch for fire-and-forget worker calls
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", mockFetch);

const { connectDiscogs, triggerSync, disconnectDiscogs, triggerReimport } = await import(
	"@/actions/discogs"
);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	mockRateLimitSuccess = true;
	adminChainResults = [];
	adminCallCount = 0;
	mockGetRequestToken.mockReset();
	mockDeleteTokens.mockReset();
	mockCookieSet.mockReset();
	mockFetch.mockReset().mockResolvedValue({ ok: true });
	vi.clearAllMocks();
});

// ---- connectDiscogs ------------------------------------------------------

describe("connectDiscogs", () => {
	it("returns authorize URL on success", async () => {
		mockGetRequestToken.mockResolvedValueOnce({
			token: "req-token",
			tokenSecret: "req-secret",
			authorizeUrl: "https://discogs.com/oauth/authorize?oauth_token=req-token",
		});

		const result = await connectDiscogs();
		expect(result).toHaveProperty("url");
		expect((result as { url: string }).url).toContain("discogs.com");
	});

	it("stores request token in httpOnly cookie", async () => {
		mockGetRequestToken.mockResolvedValueOnce({
			token: "req-token",
			tokenSecret: "req-secret",
			authorizeUrl: "https://discogs.com/oauth/authorize?oauth_token=req-token",
		});

		await connectDiscogs();
		expect(mockCookieSet).toHaveBeenCalledWith(
			"discogs_oauth",
			expect.stringContaining("req-token"),
			expect.objectContaining({
				httpOnly: true,
				sameSite: "lax",
				maxAge: 600,
			}),
		);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await connectDiscogs();
		expect(result).toEqual({ error: "Not authenticated" });
	});

	it("rejects when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await connectDiscogs();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Too many requests");
	});

	it("handles OAuth request token failure", async () => {
		mockGetRequestToken.mockRejectedValueOnce(new Error("Discogs down"));

		const result = await connectDiscogs();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Failed to connect");
	});
});

// ---- triggerSync ---------------------------------------------------------

describe("triggerSync", () => {
	it("creates sync job when no active job exists", async () => {
		adminChainResults = [
			{ data: [], error: null }, // no active jobs
			{ data: { id: "job-123" }, error: null }, // insert returns job
		];

		const result = await triggerSync();
		expect(result).toEqual({ success: true });
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await triggerSync();
		expect(result).toEqual({ error: "Not authenticated" });
	});

	it("rejects when an import is already in progress", async () => {
		adminChainResults = [
			{ data: [{ id: "existing-job" }], error: null }, // active job exists
		];

		const result = await triggerSync();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("already in progress");
	});

	it("rejects when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await triggerSync();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Too many requests");
	});

	it("handles job creation failure", async () => {
		adminChainResults = [
			{ data: [], error: null }, // no active jobs
			{ data: null, error: { message: "DB error" } }, // insert fails
		];

		const result = await triggerSync();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Could not start sync");
	});
});

// ---- disconnectDiscogs ---------------------------------------------------

describe("disconnectDiscogs", () => {
	it("completes full disconnect flow on success", async () => {
		// 5 admin calls: cancel jobs, delete collection, delete wantlist, update profile, deleteTokens
		adminChainResults = [
			{ data: null, error: null }, // cancel active jobs
			{ data: null, error: null }, // delete collection items
			{ data: null, error: null }, // delete wantlist items
			{ data: null, error: null }, // update profile
		];
		mockDeleteTokens.mockResolvedValueOnce(undefined);

		const result = await disconnectDiscogs();
		expect(result).toEqual({ success: true });
		expect(mockDeleteTokens).toHaveBeenCalledWith(USER_ID);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await disconnectDiscogs();
		expect(result).toEqual({ error: "Not authenticated" });
	});

	it("rejects when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await disconnectDiscogs();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Too many requests");
	});
});

// ---- triggerReimport -----------------------------------------------------

describe("triggerReimport", () => {
	it("deletes existing items and creates fresh import job", async () => {
		adminChainResults = [
			{ data: [], error: null }, // no active jobs
			{ data: null, error: null }, // delete collection items
			{ data: null, error: null }, // delete wantlist items
			{ data: { id: "new-job-456" }, error: null }, // insert new job
		];

		const result = await triggerReimport();
		expect(result).toHaveProperty("success", true);
		expect(result).toHaveProperty("redirectTo", "/import-progress");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await triggerReimport();
		expect(result).toEqual({ error: "Not authenticated" });
	});

	it("rejects when an import is already in progress", async () => {
		adminChainResults = [
			{ data: [{ id: "active-job" }], error: null }, // active job exists
		];

		const result = await triggerReimport();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("already in progress");
	});

	it("rejects when rate limited", async () => {
		mockRateLimitSuccess = false;
		const result = await triggerReimport();
		expect(result).toHaveProperty("error");
		expect((result as { error: string }).error).toContain("Too many requests");
	});
});
