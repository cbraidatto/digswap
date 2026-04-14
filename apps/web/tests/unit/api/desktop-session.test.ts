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

const { mockGetUser, mockStoreHandoffCode, mockSafeLimit } = vi.hoisted(() => ({
	mockGetUser: vi.fn(),
	mockStoreHandoffCode: vi.fn(),
	mockSafeLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: mockGetUser,
		},
	})),
}));

vi.mock("@/lib/desktop/handoff-store", () => ({
	storeHandoffCode: mockStoreHandoffCode,
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: mockSafeLimit,
}));

const { POST, GET } = await import("@/app/api/desktop/session/route");

beforeEach(() => {
	vi.clearAllMocks();
	mockSafeLimit.mockResolvedValue({ success: true });
});

describe("Desktop session route - POST", () => {
	it("returns 401 when user is not authenticated", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});

		const response = await POST();

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toContain("Not authenticated");
	});

	it("returns a handoff code with expiresIn=30 for authenticated user", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		mockStoreHandoffCode.mockResolvedValue(undefined);

		const response = await POST();

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.code).toBeDefined();
		expect(typeof body.code).toBe("string");
		expect(body.code.length).toBeGreaterThan(0);
		expect(body.expiresIn).toBe(30);
		expect(mockStoreHandoffCode).toHaveBeenCalledWith(expect.any(String), "user-1");
	});

	it("returns 429 when rate limited", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		mockSafeLimit.mockResolvedValue({ success: false });

		const response = await POST();

		expect(response.status).toBe(429);
		const body = await response.json();
		expect(body.error).toContain("Too many requests");
	});

	it("returns 503 when handoff store fails", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});
		mockStoreHandoffCode.mockRejectedValue(new Error("Redis down"));

		const response = await POST();

		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.error).toContain("Service unavailable");
	});
});

describe("Desktop session route - GET", () => {
	it("returns 410 Gone (deprecated endpoint)", async () => {
		const response = await GET();

		expect(response.status).toBe(410);
		const body = await response.json();
		expect(body.error).toContain("no longer returns session tokens");
	});
});
