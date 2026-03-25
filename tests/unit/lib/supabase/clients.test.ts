import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
	createBrowserClient: vi.fn(() => ({
		auth: { getUser: vi.fn() },
		from: vi.fn(),
	})),
	createServerClient: vi.fn(() => ({
		auth: {
			getUser: vi.fn(),
			getClaims: vi.fn(() =>
				Promise.resolve({ data: { claims: null }, error: null }),
			),
		},
		from: vi.fn(),
	})),
}));

// Mock @supabase/supabase-js
vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({
		auth: { admin: { listUsers: vi.fn() } },
		from: vi.fn(),
	})),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
	cookies: vi.fn(() =>
		Promise.resolve({
			getAll: vi.fn(() => []),
			set: vi.fn(),
		}),
	),
}));

// Mock next/server
vi.mock("next/server", () => {
	const mockResponse = {
		cookies: {
			set: vi.fn(),
			getAll: vi.fn(() => []),
		},
		headers: new Map(),
	};
	return {
		NextResponse: {
			next: vi.fn(() => mockResponse),
			redirect: vi.fn((url: unknown) => ({
				...mockResponse,
				redirectUrl: url,
			})),
		},
	};
});

// Set env vars for tests
beforeEach(() => {
	process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
	process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
	process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

describe("Supabase Client Factories", () => {
	it("server client factory returns a Supabase client object", async () => {
		const { createClient } = await import("@/lib/supabase/server");
		const client = await createClient();
		expect(client).toBeDefined();
		expect(client.auth).toBeDefined();
		expect(client.from).toBeDefined();
	});

	it("admin client uses service role key (not anon key)", async () => {
		const { createAdminClient } = await import("@/lib/supabase/admin");
		const { createClient: mockCreateClient } = await import(
			"@supabase/supabase-js"
		);
		const client = createAdminClient();
		expect(client).toBeDefined();
		expect(mockCreateClient).toHaveBeenCalledWith(
			"https://test.supabase.co",
			"test-service-role-key",
			expect.objectContaining({
				auth: expect.objectContaining({
					autoRefreshToken: false,
					persistSession: false,
				}),
			}),
		);
	});

	it("browser client factory returns a Supabase client object", async () => {
		const { createClient } = await import("@/lib/supabase/client");
		const client = createClient();
		expect(client).toBeDefined();
		expect(client.auth).toBeDefined();
	});
});

describe("Middleware helper", () => {
	it("middleware helper refreshes session cookies via getClaims", async () => {
		const { createServerClient } = await import("@supabase/ssr");
		const { updateSession } = await import("@/lib/supabase/middleware");

		// Create a mock NextRequest
		const mockRequest = {
			nextUrl: {
				pathname: "/some-page",
				clone: vi.fn(() => ({
					pathname: "/signin",
				})),
			},
			cookies: {
				getAll: vi.fn(() => []),
				set: vi.fn(),
			},
		};

		const response = await updateSession(mockRequest as any);
		expect(response).toBeDefined();
		// Verify createServerClient was called (which sets up cookie handling)
		expect(createServerClient).toHaveBeenCalled();
	});
});
