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
	mockAdminFrom,
	mockProcessImportPage,
	mockProcessWantlistPage,
	mockBroadcastProgress,
	mockAwardBadge,
	mockCheckWantlistMatches,
} = vi.hoisted(() => ({
	mockAdminFrom: vi.fn(),
	mockProcessImportPage: vi.fn(),
	mockProcessWantlistPage: vi.fn(),
	mockBroadcastProgress: vi.fn(),
	mockAwardBadge: vi.fn(),
	mockCheckWantlistMatches: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockAdminFrom,
	})),
}));

vi.mock("@/lib/discogs/import-worker", () => ({
	processImportPage: mockProcessImportPage,
	processWantlistPage: mockProcessWantlistPage,
}));

vi.mock("@/lib/discogs/broadcast", () => ({
	broadcastProgress: mockBroadcastProgress,
}));

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: mockAwardBadge,
}));

vi.mock("@/lib/gems/constants", () => ({
	getGemInfo: vi.fn(() => ({ name: "Test Gem" })),
}));

vi.mock("@/lib/gems/notifications", () => ({
	detectGemTierChanges: vi.fn(() => []),
}));

vi.mock("@/lib/notifications/match", () => ({
	checkWantlistMatches: mockCheckWantlistMatches,
}));

const { POST } = await import("@/app/api/discogs/import/route");

function createRequest(body?: unknown, authHeader?: string) {
	const headers: Record<string, string> = {
		"content-type": "application/json",
	};
	if (authHeader) {
		headers.authorization = authHeader;
	}

	return new Request("http://localhost:3000/api/discogs/import", {
		method: "POST",
		headers,
		body: body !== undefined ? JSON.stringify(body) : "{}",
	}) as unknown as import("next/server").NextRequest;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("Discogs import worker route", () => {
	it("returns 401 when Authorization header is missing", async () => {
		const response = await POST(createRequest({ jobId: "job-1" }));

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("returns 401 when the secret is wrong", async () => {
		const response = await POST(createRequest({ jobId: "job-1" }, "Bearer wrong-secret"));

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("returns 400 when jobId is missing from body", async () => {
		const response = await POST(createRequest({}, "Bearer test-import-worker-secret"));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe("Missing jobId");
	});

	it("returns 404 when job does not exist", async () => {
		mockAdminFrom.mockReturnValue({
			select: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					single: vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
				}),
			}),
		});

		const response = await POST(
			createRequest({ jobId: "nonexistent" }, "Bearer test-import-worker-secret"),
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error).toBe("Job not found");
	});

	it("returns 200 idempotently when the job is already completed", async () => {
		mockAdminFrom.mockReturnValue({
			select: vi.fn().mockReturnValue({
				eq: vi.fn().mockReturnValue({
					single: vi.fn().mockResolvedValue({
						data: {
							id: "job-1",
							status: "completed",
							user_id: "user-1",
							type: "collection",
							current_page: 1,
						},
						error: null,
					}),
				}),
			}),
		});

		const response = await POST(
			createRequest({ jobId: "job-1" }, "Bearer test-import-worker-secret"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.message).toBe("Job already finished");
	});
});
