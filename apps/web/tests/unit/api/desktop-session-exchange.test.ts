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

const { mockConsumeHandoffCode, mockGetUserById, mockSafeLimit } = vi.hoisted(() => ({
	mockConsumeHandoffCode: vi.fn(),
	mockGetUserById: vi.fn(),
	mockSafeLimit: vi.fn(),
}));

vi.mock("@/lib/desktop/handoff-store", () => ({
	consumeHandoffCode: mockConsumeHandoffCode,
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		auth: {
			admin: {
				getUserById: mockGetUserById,
			},
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	safeLimit: mockSafeLimit,
}));

const { POST } = await import("@/app/api/desktop/session/exchange/route");

function createRequest(body?: unknown) {
	return new Request("http://localhost:3000/api/desktop/session/exchange", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-forwarded-for": "127.0.0.1",
		},
		body: body !== undefined ? JSON.stringify(body) : "{}",
	}) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSafeLimit.mockResolvedValue({ success: true });
});

describe("Desktop session exchange route", () => {
	it("returns 401 when code is invalid or expired", async () => {
		mockConsumeHandoffCode.mockResolvedValue(null);

		const response = await POST(createRequest({ code: "invalid-code" }));

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toContain("Invalid or expired");
	});

	it("returns 400 when code is missing from body", async () => {
		const response = await POST(createRequest({}));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("required");
	});

	it("returns userId (no email) when code is valid", async () => {
		mockConsumeHandoffCode.mockResolvedValue("user-123");
		mockGetUserById.mockResolvedValue({
			data: {
				user: { id: "user-123", email: "secret@example.com" },
			},
			error: null,
		});

		const response = await POST(createRequest({ code: "valid-code" }));

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.userId).toBe("user-123");
		// SECURITY: email must NOT be returned
		expect(body.email).toBeUndefined();
	});

	it("returns 429 when rate limited", async () => {
		mockSafeLimit.mockResolvedValue({ success: false });

		const response = await POST(createRequest({ code: "some-code" }));

		expect(response.status).toBe(429);
		const body = await response.json();
		expect(body.error).toContain("Too many requests");
	});

	it("returns 404 when user lookup fails", async () => {
		mockConsumeHandoffCode.mockResolvedValue("user-gone");
		mockGetUserById.mockResolvedValue({
			data: { user: null },
			error: { message: "User not found" },
		});

		const response = await POST(createRequest({ code: "valid-code" }));

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toContain("not found");
	});
});
