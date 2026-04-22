import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "11111111-1111-4111-8111-111111111111";
const RELEASE_ID = "22222222-2222-4222-8222-222222222222";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: mockAuthUser ? null : { message: "Not authenticated" },
			})),
		},
	})),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/env", () => ({
	env: { YOUTUBE_API_KEY: "fake-key" },
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: vi.fn(() => ({
			update: vi.fn(() => ({
				eq: vi.fn(async () => ({ error: null })),
			})),
		})),
	})),
}));

vi.mock("@/lib/community/queries", () => ({
	getReviewsForRelease: vi.fn(async () => [{ id: "review-1", text: "Great" }]),
}));

// Mock global fetch for YouTube API
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "orderBy", "limit", "innerJoin", "leftJoin"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};
	return { db: chain };
});

vi.mock("@/lib/db/schema/releases", () => ({
	releases: {
		id: "id",
		title: "title",
		artist: "artist",
		youtubeVideoId: "youtube_video_id",
		coverImageUrl: "cover_image_url",
		year: "year",
		rarityScore: "rarity_score",
		discogsId: "discogs_id",
	},
}));

vi.mock("@/lib/validations/release", () => ({
	releaseIdSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { releaseInternalId?: string };
			if (
				d?.releaseInternalId &&
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(d.releaseInternalId)
			) {
				return { success: true, data: d };
			}
			return { success: false };
		}),
	},
	getMoreReviewsSchema: {
		safeParse: vi.fn((data: unknown) => {
			const d = data as { releaseId?: string; cursor?: string; limit?: number };
			if (d?.releaseId && d?.cursor) {
				return {
					success: true,
					data: { releaseId: d.releaseId, cursor: d.cursor, limit: d.limit ?? 10 },
				};
			}
			return { success: false };
		}),
	},
}));

const { searchYouTubeForRelease, getMoreReviews } = await import("@/actions/release");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
	mockFetch.mockReset();
});

describe("searchYouTubeForRelease", () => {
	it("returns error for invalid release ID", async () => {
		const result = await searchYouTubeForRelease("not-a-uuid");
		expect(result.videoId).toBeNull();
		expect(result.error).toBe("Invalid release ID");
	});

	it("returns error when not authenticated", async () => {
		mockAuthUser = null;
		const result = await searchYouTubeForRelease(RELEASE_ID);
		expect(result.videoId).toBeNull();
		expect(result.error).toBe("Authentication required");
	});

	it("returns cached videoId when release already has one", async () => {
		selectResults = [
			[{ id: RELEASE_ID, title: "Test", artist: "Artist", youtubeVideoId: "abc123" }],
		];
		const result = await searchYouTubeForRelease(RELEASE_ID);
		expect(result.videoId).toBe("abc123");
		expect(result.error).toBeUndefined();
	});

	it("returns error when release not found", async () => {
		selectResults = [[]];
		const result = await searchYouTubeForRelease(RELEASE_ID);
		expect(result.videoId).toBeNull();
		expect(result.error).toBe("Release not found");
	});

	it("calls YouTube API and returns videoId when no cache", async () => {
		selectResults = [
			[{ id: RELEASE_ID, title: "Blue Train", artist: "Coltrane", youtubeVideoId: null }],
		];
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({ items: [{ id: { videoId: "yt-video-1" } }] }),
		});

		const result = await searchYouTubeForRelease(RELEASE_ID);
		expect(result.videoId).toBe("yt-video-1");
	});

	it("returns null videoId when YouTube API fails", async () => {
		selectResults = [
			[{ id: RELEASE_ID, title: "Blue Train", artist: "Coltrane", youtubeVideoId: null }],
		];
		mockFetch.mockResolvedValueOnce({ ok: false });

		const result = await searchYouTubeForRelease(RELEASE_ID);
		expect(result.videoId).toBeNull();
		expect(result.error).toBeUndefined();
	});
});

describe("getMoreReviews", () => {
	it("returns empty array when not authenticated", async () => {
		mockAuthUser = null;
		const result = await getMoreReviews(RELEASE_ID, "cursor-1");
		expect(result).toEqual([]);
	});

	it("returns empty array for invalid input", async () => {
		const result = await getMoreReviews("", "");
		expect(result).toEqual([]);
	});

	it("returns reviews for valid request", async () => {
		const result = await getMoreReviews(RELEASE_ID, "2025-01-01T00:00:00Z");
		expect(Array.isArray(result)).toBe(true);
	});
});
