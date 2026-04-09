import { beforeEach, describe, expect, test, vi } from "vitest";

// Use vi.hoisted to declare mocks that will be used inside vi.mock factories
const mockSend = vi.hoisted(() => vi.fn());

// -- Mock env module (cached at import time, so process.env mutations don't work) --
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
		RESEND_API_KEY: "test-resend-key",
		RESEND_FROM_EMAIL: "noreply@digswap.com",
		STRIPE_WEBHOOK_SECRET: "",
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

// Mock the resend module with a proper class constructor
vi.mock("resend", () => {
	return {
		Resend: class MockResend {
			emails = { send: mockSend };
		},
	};
});

import { sendWantlistMatchEmail } from "@/lib/notifications/email";

describe("sendWantlistMatchEmail", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
	});

	test("calls resend.emails.send with correct subject", async () => {
		await sendWantlistMatchEmail("user@example.com", "Kind of Blue", "Miles Davis", "jazzhound");

		expect(mockSend).toHaveBeenCalledTimes(1);
		const callArgs = mockSend.mock.calls[0][0];
		expect(callArgs.subject).toBe("Someone has a record from your wantlist");
		expect(callArgs.to).toBe("user@example.com");
	});

	test("does not throw on Resend error", async () => {
		mockSend.mockRejectedValue(new Error("API rate limited"));

		await expect(
			sendWantlistMatchEmail("user@example.com", "Kind of Blue", "Miles Davis", "jazzhound"),
		).resolves.toBeUndefined();
	});

	test("email body contains record title, artist, and owner username", async () => {
		await sendWantlistMatchEmail(
			"user@example.com",
			"A Love Supreme",
			"John Coltrane",
			"crateking",
		);

		const callArgs = mockSend.mock.calls[0][0];
		expect(callArgs.html).toContain("A Love Supreme");
		expect(callArgs.html).toContain("John Coltrane");
		expect(callArgs.html).toContain("crateking");
	});
});
