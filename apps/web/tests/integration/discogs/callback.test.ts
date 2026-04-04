import { describe, test, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted for all mock references used in vi.mock factories
const {
	mockCookieGet,
	mockCookieDelete,
	mockRedirect,
	mockJson,
	mockGetAccessToken,
	mockStoreTokens,
	mockGetUser,
	mockGetIdentity,
	mockFetch,
} = vi.hoisted(() => ({
	mockCookieGet: vi.fn(),
	mockCookieDelete: vi.fn(),
	mockRedirect: vi.fn(),
	mockJson: vi.fn(),
	mockGetAccessToken: vi.fn(),
	mockStoreTokens: vi.fn(),
	mockGetUser: vi.fn(),
	mockGetIdentity: vi.fn(),
	mockFetch: vi.fn().mockResolvedValue({ ok: true }),
}));

// -- Mock next/headers --
vi.mock("next/headers", () => ({
	cookies: vi.fn().mockResolvedValue({
		get: mockCookieGet,
		delete: mockCookieDelete,
	}),
}));

// -- Mock next/server --
vi.mock("next/server", () => ({
	NextRequest: vi.fn(),
	NextResponse: {
		redirect: (url: string) => {
			mockRedirect(url);
			return { url };
		},
		json: (body: unknown, init?: { status?: number }) => {
			mockJson(body, init);
			return { body, status: init?.status };
		},
	},
}));

// -- Mock rate-limit --
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

// -- Mock OAuth helpers --
vi.mock("@/lib/discogs/oauth", () => ({
	getAccessToken: (...args: unknown[]) => mockGetAccessToken(...args),
	storeTokens: (...args: unknown[]) => mockStoreTokens(...args),
}));

// -- Mock Supabase server client --
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn().mockResolvedValue({
		auth: {
			getUser: () => mockGetUser(),
		},
	}),
}));

// -- Mock Supabase admin client --
const adminFromHandlers: Record<string, unknown> = {};

function createAdminChain(resolveValue: unknown = { data: null, error: null }) {
	const chain: Record<string, ReturnType<typeof vi.fn>> = {};
	chain.select = vi.fn().mockReturnValue(chain);
	chain.insert = vi.fn().mockReturnValue(chain);
	chain.update = vi.fn().mockReturnValue(chain);
	chain.eq = vi.fn().mockReturnValue(chain);
	chain.in = vi.fn().mockReturnValue(chain);
	chain.limit = vi.fn().mockResolvedValue(resolveValue);
	chain.single = vi.fn().mockResolvedValue(resolveValue);
	return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn((table: string) => {
			if (adminFromHandlers[table]) return adminFromHandlers[table];
			return createAdminChain();
		}),
	})),
}));

// -- Mock Discogs client --
vi.mock("@lionralfs/discogs-client", () => ({
	DiscogsClient: class MockDiscogsClient {
		getIdentity = mockGetIdentity;
	},
}));

// Mock global fetch for fire-and-forget self-invocation
vi.stubGlobal("fetch", mockFetch);

import { GET } from "@/app/api/discogs/callback/route";

describe("Discogs OAuth callback route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
		process.env.DISCOGS_CONSUMER_KEY = "test_key";
		process.env.DISCOGS_CONSUMER_SECRET = "test_secret";
		process.env.IMPORT_WORKER_SECRET = "worker_secret";
		// Reset admin handlers
		for (const key of Object.keys(adminFromHandlers)) {
			delete adminFromHandlers[key];
		}
	});

	function createRequest(params: Record<string, string>) {
		const url = new URL("http://localhost:3000/api/discogs/callback");
		for (const [key, value] of Object.entries(params)) {
			url.searchParams.set(key, value);
		}
		return {
			url: url.toString(),
			headers: new Headers(),
		} as unknown as Parameters<typeof GET>[0];
	}

	test("redirects to settings with error when oauth params missing", async () => {
		const request = createRequest({});

		await GET(request);

		expect(mockRedirect).toHaveBeenCalledWith(
			expect.stringContaining("/settings?error="),
		);
	});

	test("redirects to settings when OAuth cookie is missing", async () => {
		mockCookieGet.mockReturnValue(undefined);
		const request = createRequest({
			oauth_token: "token123",
			oauth_verifier: "verifier456",
		});

		await GET(request);

		expect(mockRedirect).toHaveBeenCalledWith(
			expect.stringContaining("/settings?error="),
		);
	});

	test("exchanges verifier, stores tokens, updates profile, creates import job, and redirects", async () => {
		// Cookie with request token
		mockCookieGet.mockReturnValue({
			value: JSON.stringify({ token: "req_tok", tokenSecret: "req_sec" }),
		});

		// Access token exchange
		mockGetAccessToken.mockResolvedValue({
			accessToken: "acc_tok",
			accessTokenSecret: "acc_sec",
		});

		// Authenticated user
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-123" } },
		});

		// Discogs identity
		mockGetIdentity.mockResolvedValue({
			data: { username: "vinyldigger42" },
		});

		// Store tokens succeeds
		mockStoreTokens.mockResolvedValue(undefined);

		// Profile update chain
		const profileChain = createAdminChain();
		adminFromHandlers["profiles"] = profileChain;

		// Import jobs chain
		const importJobsChain = createAdminChain();
		importJobsChain.select = vi.fn().mockReturnValue({
			eq: vi.fn().mockReturnValue({
				in: vi.fn().mockReturnValue({
					limit: vi.fn().mockResolvedValue({ data: [], error: null }),
				}),
			}),
		});
		importJobsChain.insert = vi.fn().mockReturnValue({
			select: vi.fn().mockReturnValue({
				single: vi.fn().mockResolvedValue({ data: { id: "new-job-id" }, error: null }),
			}),
		});
		adminFromHandlers["import_jobs"] = importJobsChain;

		const request = createRequest({
			oauth_token: "req_tok",
			oauth_verifier: "verifier_code",
		});

		await GET(request);

		// Verify access token exchange
		expect(mockGetAccessToken).toHaveBeenCalledWith("req_tok", "req_sec", "verifier_code");

		// Verify tokens stored
		expect(mockStoreTokens).toHaveBeenCalledWith("user-123", "acc_tok", "acc_sec");

		// Verify redirect to import-progress
		expect(mockRedirect).toHaveBeenCalledWith("http://localhost:3000/import-progress");

		// Verify cookie cleared
		expect(mockCookieDelete).toHaveBeenCalledWith("discogs_oauth");
	});
});
