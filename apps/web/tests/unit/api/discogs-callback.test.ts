import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
	env: {
		DATABASE_URL: "postgresql://test:test@localhost:5432/test",
		SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
		DISCOGS_CONSUMER_KEY: "test-discogs-key",
		DISCOGS_CONSUMER_SECRET: "test-discogs-secret",
		IMPORT_WORKER_SECRET: "test-import-worker-secret",
		HANDOFF_HMAC_SECRET: "dev-hmac-secret-not-for-production",
		UPSTASH_REDIS_REST_URL: "",
		UPSTASH_REDIS_REST_TOKEN: "",
		RESEND_API_KEY: "",
		RESEND_FROM_EMAIL: "noreply@digswap.com",
		STRIPE_WEBHOOK_SECRET: "whsec_test",
		YOUTUBE_API_KEY: "",
		SYSTEM_USER_ID: "",
		NODE_ENV: "test",
	},
	publicEnv: {
		NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
		NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
		NEXT_PUBLIC_APP_URL: "http://localhost:3000",
		NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: "",
		NEXT_PUBLIC_STRIPE_PRICE_ANNUAL: "",
		NEXT_PUBLIC_MIN_DESKTOP_VERSION: "1",
	},
}));

const {
	mockGetAccessToken,
	mockStoreTokens,
	mockCookiesGet,
	mockCookiesDelete,
	mockGetUser,
	mockGetIdentity,
	mockAdminFrom,
	mockSafeLimit,
} = vi.hoisted(() => ({
	mockGetAccessToken: vi.fn(),
	mockStoreTokens: vi.fn(),
	mockCookiesGet: vi.fn(),
	mockCookiesDelete: vi.fn(),
	mockGetUser: vi.fn(),
	mockGetIdentity: vi.fn(),
	mockAdminFrom: vi.fn(),
	mockSafeLimit: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({
		get: mockCookiesGet,
		delete: mockCookiesDelete,
	})),
}));

vi.mock("@/lib/discogs/oauth", () => ({
	getAccessToken: mockGetAccessToken,
	storeTokens: mockStoreTokens,
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: mockGetUser,
		},
	})),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockAdminFrom,
	})),
}));

vi.mock("@lionralfs/discogs-client", () => ({
	DiscogsClient: class MockDiscogsClient {
		getIdentity = mockGetIdentity;
	},
}));

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	safeLimit: mockSafeLimit,
}));

const { GET } = await import("@/app/api/discogs/callback/route");

function createRequest(params: Record<string, string> = {}) {
	const url = new URL("http://localhost:3000/api/discogs/callback");
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}
	return new Request(url.toString(), {
		method: "GET",
		headers: { "x-forwarded-for": "127.0.0.1" },
	}) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSafeLimit.mockResolvedValue({ success: true });
});

describe("Discogs callback route", () => {
	it("redirects to /settings with error when oauth_token is missing", async () => {
		const response = await GET(createRequest({ oauth_verifier: "verifier123" }));

		expect(response.status).toBe(307);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/settings?error=");
		expect(location).toContain("authorization%20failed");
	});

	it("redirects to /settings with error when oauth_verifier is missing", async () => {
		const response = await GET(createRequest({ oauth_token: "token123" }));

		expect(response.status).toBe(307);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/settings?error=");
	});

	it("redirects with error when OAuth cookie has expired (not present)", async () => {
		mockCookiesGet.mockReturnValue(undefined);

		const response = await GET(
			createRequest({ oauth_token: "token123", oauth_verifier: "verifier123" }),
		);

		expect(response.status).toBe(307);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/settings?error=");
		expect(location).toContain("expired");
	});

	it("redirects with error when callback token does not match cookie token (CSRF)", async () => {
		mockCookiesGet.mockReturnValue({
			value: JSON.stringify({ token: "different-token", tokenSecret: "secret123" }),
		});

		const response = await GET(
			createRequest({ oauth_token: "token123", oauth_verifier: "verifier123" }),
		);

		expect(response.status).toBe(307);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/settings?error=");
		expect(location).toContain("mismatch");
		expect(mockCookiesDelete).toHaveBeenCalledWith("discogs_oauth");
	});

	it("completes the OAuth flow and redirects to /import-progress", async () => {
		const oauthToken = "matching-token";
		mockCookiesGet.mockReturnValue({
			value: JSON.stringify({ token: oauthToken, tokenSecret: "secret123" }),
		});
		mockGetAccessToken.mockResolvedValue({
			accessToken: "access-token",
			accessTokenSecret: "access-secret",
		});
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		mockGetIdentity.mockResolvedValue({
			data: { username: "vinyl_digger" },
		});
		mockStoreTokens.mockResolvedValue(undefined);

		// Admin client chain mocks
		const mockEq = vi.fn().mockResolvedValue({ error: null });
		const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
		const mockIn = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [] }) });
		const mockSelectEq = vi.fn().mockReturnValue({ in: mockIn });
		const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });
		const mockInsertSingle = vi.fn().mockResolvedValue({ data: { id: "job-1" } });
		const mockInsertSelect = vi.fn().mockReturnValue({ single: mockInsertSingle });
		const mockInsert = vi
			.fn()
			.mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockInsertSingle }) });

		mockAdminFrom.mockImplementation((table: string) => {
			if (table === "profiles") return { update: mockUpdate };
			if (table === "import_jobs") return { select: mockSelect, insert: mockInsert };
			return {};
		});

		// Mock global fetch for fire-and-forget import trigger
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue(new Response("ok"));

		try {
			const response = await GET(
				createRequest({ oauth_token: oauthToken, oauth_verifier: "verifier123" }),
			);

			expect(response.status).toBe(307);
			const location = response.headers.get("location") ?? "";
			expect(location).toContain("/import-progress");
			expect(mockCookiesDelete).toHaveBeenCalledWith("discogs_oauth");
			expect(mockStoreTokens).toHaveBeenCalledWith("user-1", "access-token", "access-secret");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
