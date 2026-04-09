import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks (vi.mock factories are hoisted, so we use vi.hoisted)
// ---------------------------------------------------------------------------
const { mockGetUser, mockUpdate, mockRateLimitFn, mockFetch, mockEnv } = vi.hoisted(() => ({
	mockGetUser: vi.fn(),
	mockUpdate: vi.fn(),
	mockRateLimitFn: vi.fn(),
	mockFetch: vi.fn(),
	mockEnv: {
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
		STRIPE_WEBHOOK_SECRET: "",
		YOUTUBE_API_KEY: "test-api-key-123",
		SYSTEM_USER_ID: "",
		NODE_ENV: "test",
	},
}));

// -- Mock env module (cached at import time, so process.env mutations don't work) --
vi.mock("@/lib/env", () => ({
	env: mockEnv,
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

// ---------------------------------------------------------------------------
// DB mock with thenable chain (project pattern)
// ---------------------------------------------------------------------------
let queryCallCount = 0;
let queryResults: unknown[][] = [];

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};

	const methods = [
		"select",
		"from",
		"where",
		"orderBy",
		"limit",
		"innerJoin",
		"leftJoin",
		"groupBy",
		"offset",
	];

	for (const method of methods) {
		chain[method] = vi.fn().mockImplementation(() => chain);
	}

	// Thenable: resolves with the next result set
	chain.then = (resolve: (v: unknown) => void) => {
		const result = queryResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};

	return { db: chain };
});

// ---------------------------------------------------------------------------
// Schema mocks
// ---------------------------------------------------------------------------
vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		discogsId: "discogs_id",
		youtubeVideoId: "youtube_video_id",
		title: "title",
		artist: "artist",
	},
}));

// ---------------------------------------------------------------------------
// Supabase auth mock (default: authenticated)
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: { getUser: mockGetUser },
	})),
}));

// ---------------------------------------------------------------------------
// Admin client mock
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => ({
		from: vi.fn().mockReturnValue({
			update: mockUpdate,
		}),
	}),
}));

// ---------------------------------------------------------------------------
// Rate limit mock (default: not limited)
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: mockRateLimitFn.mockImplementation(async () => ({ success: true })),
}));

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------
vi.stubGlobal("fetch", mockFetch);

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { searchYouTubeForRelease } from "@/actions/release";

describe("searchYouTubeForRelease", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];

		// Reset default mocks
		mockGetUser.mockResolvedValue({ data: { user: { id: "test-user-id" } } });
		mockRateLimitFn.mockResolvedValue({ success: true });
		mockUpdate.mockReturnValue({
			eq: vi.fn().mockResolvedValue({ data: null, error: null }),
		});

		// Default: YOUTUBE_API_KEY is set (reset for tests that clear it)
		mockEnv.YOUTUBE_API_KEY = "test-api-key-123";
	});

	test("returns cached videoId without calling YouTube API", async () => {
		queryResults = [
			[
				{
					id: "a0000000-0000-4000-a000-000000000001",
					title: "Kind of Blue",
					artist: "Miles Davis",
					youtubeVideoId: "cached123",
				},
			],
		];

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBe("cached123");
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test("calls YouTube API and caches result on cache miss", async () => {
		queryResults = [
			[
				{
					id: "a0000000-0000-4000-a000-000000000001",
					title: "Kind of Blue",
					artist: "Miles Davis",
					youtubeVideoId: null,
				},
			],
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				items: [{ id: { videoId: "dQw4w9WgXcQ" } }],
			}),
		});

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBe("dQw4w9WgXcQ");
		expect(mockFetch).toHaveBeenCalledTimes(1);
		// Verify cache write via admin client
		expect(mockUpdate).toHaveBeenCalled();
	});

	test("returns null when YouTube API returns no results", async () => {
		queryResults = [
			[
				{
					id: "a0000000-0000-4000-a000-000000000001",
					title: "Obscure Album",
					artist: "Unknown Artist",
					youtubeVideoId: null,
				},
			],
		];

		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ items: [] }),
		});

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBeNull();
	});

	test("returns null when YouTube API returns error (quota exceeded)", async () => {
		queryResults = [
			[
				{
					id: "a0000000-0000-4000-a000-000000000001",
					title: "Kind of Blue",
					artist: "Miles Davis",
					youtubeVideoId: null,
				},
			],
		];

		mockFetch.mockResolvedValue({
			ok: false,
			status: 403,
			json: async () => ({ error: { code: 403, message: "quotaExceeded" } }),
		});

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBeNull();
		expect(result.error).toBeUndefined();
	});

	test("returns null when YOUTUBE_API_KEY is not set", async () => {
		mockEnv.YOUTUBE_API_KEY = "";

		queryResults = [
			[
				{
					id: "a0000000-0000-4000-a000-000000000001",
					title: "Kind of Blue",
					artist: "Miles Davis",
					youtubeVideoId: null,
				},
			],
		];

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBeNull();
		expect(mockFetch).not.toHaveBeenCalled();
	});

	test("returns error when user is not authenticated", async () => {
		mockGetUser.mockResolvedValue({ data: { user: null } });

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBeNull();
		expect(result.error).toBe("Authentication required");
	});

	test("returns error when rate limited", async () => {
		mockRateLimitFn.mockResolvedValue({ success: false });

		const result = await searchYouTubeForRelease("a0000000-0000-4000-a000-000000000001");

		expect(result.videoId).toBeNull();
		expect(result.error).toBe("Rate limited");
	});
});
