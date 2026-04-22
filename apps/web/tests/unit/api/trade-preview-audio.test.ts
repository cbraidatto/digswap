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

const { mockGetUser, mockDbSelect, mockCreateSignedUrl, mockGlobalFetch } = vi.hoisted(() => ({
	mockGetUser: vi.fn(),
	mockDbSelect: vi.fn(),
	mockCreateSignedUrl: vi.fn(),
	mockGlobalFetch: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: mockGetUser,
		},
	})),
}));

// Mock drizzle db — the route uses a complex select/join chain
vi.mock("@/lib/db", () => ({
	db: {
		select: mockDbSelect,
	},
}));

vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id" },
}));

vi.mock("@/lib/db/schema/trades", () => ({
	tradeProposalItems: {
		id: "id",
		proposalId: "proposal_id",
		previewStoragePath: "preview_storage_path",
	},
	tradeProposals: {
		id: "id",
		tradeId: "trade_id",
	},
	tradeRequests: {
		id: "id",
		requesterId: "requester_id",
		providerId: "provider_id",
	},
}));

vi.mock("@supabase/supabase-js", () => ({
	createClient: vi.fn(() => ({
		storage: {
			from: vi.fn(() => ({
				createSignedUrl: mockCreateSignedUrl,
			})),
		},
	})),
}));

const { GET } = await import("@/app/api/trade-preview/audio/route");

function createRequest(params: Record<string, string> = {}) {
	const url = new URL("http://localhost:3000/api/trade-preview/audio");
	for (const [k, v] of Object.entries(params)) {
		url.searchParams.set(k, v);
	}
	return new Request(url.toString(), {
		method: "GET",
	}) as unknown as import("next/server").NextRequest;
}

// Helper to set up the drizzle chain mock
function setupDbChain(result: unknown[]) {
	const chain = {
		from: vi.fn().mockReturnThis(),
		innerJoin: vi.fn().mockReturnThis(),
		where: vi.fn().mockReturnThis(),
		limit: vi.fn().mockResolvedValue(result),
	};
	mockDbSelect.mockReturnValue(chain);
	return chain;
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("Trade preview audio route", () => {
	it("returns 400 when itemId query param is missing", async () => {
		const response = await GET(createRequest({}));

		expect(response.status).toBe(400);
		const text = await response.text();
		expect(text).toContain("Missing itemId");
	});

	it("returns 401 when user is not authenticated", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: null },
		});

		const response = await GET(createRequest({ itemId: "item-1" }));

		expect(response.status).toBe(401);
		const text = await response.text();
		expect(text).toContain("Unauthorized");
	});

	it("returns 404 when proposal item has no preview path", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});

		// First query returns no item (no preview path)
		setupDbChain([]);

		const response = await GET(createRequest({ itemId: "item-1" }));

		expect(response.status).toBe(404);
		const text = await response.text();
		expect(text).toContain("Not found");
	});

	it("streams audio when user is a valid participant and preview exists", async () => {
		mockGetUser.mockResolvedValue({
			data: { user: { id: "user-1" } },
		});

		// First db.select() call: find proposal item with preview path
		const firstChain = {
			from: vi.fn().mockReturnThis(),
			innerJoin: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi
				.fn()
				.mockResolvedValue([{ previewStoragePath: "previews/audio.wav", tradeId: "trade-1" }]),
		};
		// Second db.select() call: verify participant
		const secondChain = {
			from: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([{ id: "trade-1" }]),
		};

		let callCount = 0;
		mockDbSelect.mockImplementation(() => {
			callCount++;
			return callCount === 1 ? firstChain : secondChain;
		});

		mockCreateSignedUrl.mockResolvedValue({
			data: { signedUrl: "https://storage.supabase.co/signed/audio.wav" },
			error: null,
		});

		// Mock global fetch for the upstream audio fetch
		const originalFetch = globalThis.fetch;
		globalThis.fetch = vi.fn().mockResolvedValue(
			new Response("audio-bytes", {
				status: 200,
				headers: {
					"content-type": "audio/wav",
					"content-length": "11",
				},
			}),
		);

		try {
			const response = await GET(createRequest({ itemId: "item-1" }));

			expect(response.status).toBe(200);
			expect(response.headers.get("content-type")).toBe("audio/wav");
			expect(response.headers.get("cache-control")).toContain("no-store");
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
