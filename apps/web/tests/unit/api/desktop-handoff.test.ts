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

const { mockGetUser, mockVerifyAndConsume, mockSafeLimit } = vi.hoisted(() => ({
	mockGetUser: vi.fn(),
	mockVerifyAndConsume: vi.fn(),
	mockSafeLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		auth: {
			getUser: mockGetUser,
		},
	})),
}));

vi.mock("@/lib/desktop/handoff-token", () => ({
	verifyAndConsumeHandoffToken: mockVerifyAndConsume,
}));

vi.mock("@/lib/rate-limit", () => ({
	tradeRateLimit: null,
	safeLimit: mockSafeLimit,
}));

const { POST } = await import("@/app/api/desktop/handoff/consume/route");

function createRequest(body?: unknown, bearerToken?: string) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (bearerToken) {
		headers.authorization = `Bearer ${bearerToken}`;
	}

	return new Request("http://localhost:3000/api/desktop/handoff/consume", {
		method: "POST",
		headers,
		body: body !== undefined ? JSON.stringify(body) : "{}",
	}) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSafeLimit.mockResolvedValue({ success: true });
	mockGetUser.mockResolvedValue({
		data: { user: { id: "user-1" } },
		error: null,
	});
});

describe("Desktop handoff consume route", () => {
	it("returns 401 when Authorization header is missing", async () => {
		const response = await POST(createRequest({ tradeId: "t1", token: "tok1" }));

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Missing bearer token");
	});

	it("returns 400 when body is invalid JSON", async () => {
		const request = new Request("http://localhost:3000/api/desktop/handoff/consume", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				authorization: "Bearer valid-token",
			},
			body: "not-json",
		}) as unknown as import("next/server").NextRequest;

		const response = await POST(request);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Invalid request body");
	});

	it("returns 400 when tradeId or token are missing", async () => {
		const response = await POST(createRequest({ tradeId: "t1" }, "valid-token"));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("required");
	});

	it("returns 401 when the bearer token is invalid (user not found)", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
			error: { message: "Invalid token" },
		});

		const response = await POST(createRequest({ tradeId: "t1", token: "tok1" }, "bad-token"));

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Invalid desktop session");
	});

	it("returns ok:true when handoff token is valid", async () => {
		mockVerifyAndConsume.mockResolvedValue(true);

		const response = await POST(
			createRequest({ tradeId: "trade-1", token: "valid-handoff" }, "valid-access-token"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.tradeId).toBe("trade-1");
		expect(body.userId).toBe("user-1");
	});

	it("returns 400 when handoff token is invalid/expired", async () => {
		mockVerifyAndConsume.mockResolvedValue(false);

		const response = await POST(
			createRequest({ tradeId: "trade-1", token: "expired-handoff" }, "valid-access-token"),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("invalid");
	});
});
