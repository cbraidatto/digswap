import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExchangeCodeForSession, mockSafeLimit } = vi.hoisted(() => ({
	mockExchangeCodeForSession: vi.fn(),
	mockSafeLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			exchangeCodeForSession: mockExchangeCodeForSession,
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	safeLimit: mockSafeLimit,
}));

const { GET } = await import("@/app/api/auth/callback/route");

function createRequest(params: Record<string, string> = {}) {
	const url = new URL("http://localhost:3000/api/auth/callback");
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}
	return new Request(url.toString(), {
		method: "GET",
		headers: { "x-forwarded-for": "127.0.0.1" },
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mockSafeLimit.mockResolvedValue({ success: true });
});

describe("Auth callback route", () => {
	it("exchanges a valid code and redirects to /onboarding by default", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: null });

		const response = await GET(createRequest({ code: "valid-code" }));

		expect(response.status).toBe(307);
		const location = response.headers.get("location");
		expect(location).toContain("/onboarding");
		expect(mockExchangeCodeForSession).toHaveBeenCalledWith("valid-code");
	});

	it("redirects to the 'next' param after successful auth", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: null });

		const response = await GET(createRequest({ code: "valid-code", next: "/dashboard" }));

		const location = response.headers.get("location");
		expect(location).toContain("/dashboard");
	});

	it("redirects to /signin?error when code is missing", async () => {
		const response = await GET(createRequest({}));

		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/signin?error=auth_callback_failed");
	});

	it("redirects to /signin?error when exchange fails", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: new Error("invalid") });

		const response = await GET(createRequest({ code: "bad-code" }));

		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/signin?error=auth_callback_failed");
	});

	it("prevents open redirect via protocol-relative URL (//evil.com)", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: null });

		const response = await GET(createRequest({ code: "valid-code", next: "//evil.com" }));

		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/onboarding");
		expect(location).not.toContain("evil.com");
	});

	it("prevents open redirect via absolute URL with protocol (https://evil.com)", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: null });

		const response = await GET(createRequest({ code: "valid-code", next: "https://evil.com" }));

		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/onboarding");
		expect(location).not.toContain("evil.com");
	});

	it("prevents open redirect via embedded :// (foo://bar)", async () => {
		mockExchangeCodeForSession.mockResolvedValue({ error: null });

		const response = await GET(
			createRequest({ code: "valid-code", next: "/redirect?to=http://evil.com" }),
		);

		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/onboarding");
	});

	it("returns 307 redirect to /signin?error=rate_limited when rate limited", async () => {
		mockSafeLimit.mockResolvedValue({ success: false });

		const response = await GET(createRequest({ code: "valid-code" }));

		expect(response.status).toBe(307);
		const location = response.headers.get("location") ?? "";
		expect(location).toContain("/signin?error=rate_limited");
	});
});
