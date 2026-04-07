import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const mockExchangeCodeForSession = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			exchangeCodeForSession: mockExchangeCodeForSession,
		},
	})),
}));

// ---------------------------------------------------------------------------
// Import the route handler
// ---------------------------------------------------------------------------
import { GET } from "@/app/api/auth/callback/route";

describe("Open Redirect Prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockExchangeCodeForSession.mockResolvedValue({ error: null });
	});

	it("defaults to /onboarding when next is null", async () => {
		const request = new Request("http://localhost:3000/api/auth/callback?code=abc");
		const response = await GET(request);

		expect(response.status).toBe(307);
		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/onboarding");
	});

	it("accepts valid relative path /dashboard", async () => {
		const request = new Request("http://localhost:3000/api/auth/callback?code=abc&next=/dashboard");
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/dashboard");
	});

	it("accepts valid relative path with query string", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/callback?code=abc&next=/settings?tab=profile",
		);
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toContain("/settings");
	});

	it("rejects absolute URL https://evil.com", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/callback?code=abc&next=https://evil.com",
		);
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/onboarding");
	});

	it("rejects protocol-relative URL //evil.com", async () => {
		const request = new Request("http://localhost:3000/api/auth/callback?code=abc&next=//evil.com");
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/onboarding");
	});

	it("rejects URL with :// in path like /foo://bar", async () => {
		const request = new Request("http://localhost:3000/api/auth/callback?code=abc&next=/foo://bar");
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/onboarding");
	});

	it("rejects javascript: protocol", async () => {
		const request = new Request(
			"http://localhost:3000/api/auth/callback?code=abc&next=javascript:alert(1)",
		);
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/onboarding");
	});

	it("redirects to signin error when code exchange fails", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });

		const request = new Request(
			"http://localhost:3000/api/auth/callback?code=bad-code&next=/dashboard",
		);
		const response = await GET(request);

		const location = response.headers.get("location");
		expect(location).toBe("http://localhost:3000/signin?error=auth_callback_failed");
	});
});
