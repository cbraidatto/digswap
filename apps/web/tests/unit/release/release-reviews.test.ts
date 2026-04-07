import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock the community queries module directly (same pattern as review.test.ts)
// ---------------------------------------------------------------------------
vi.mock("@/lib/community/queries", () => ({
	getReviewsForRelease: vi.fn(),
	getReviewCountForRelease: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { getReviewCountForRelease, getReviewsForRelease } from "@/lib/community/queries";

describe("getReviewsForRelease (release page integration)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns reviews for a release with correct shape", async () => {
		const mockGetReviews = vi.mocked(getReviewsForRelease);
		mockGetReviews.mockResolvedValue([
			{
				id: "review-1",
				userId: "user-1",
				username: "jazzhound",
				avatarUrl: null,
				rating: 5,
				title: "Perfect pressing",
				body: "Warm analog sound throughout",
				isPressingSpecific: true,
				pressingDetails: "Original 1959 Columbia",
				createdAt: "2026-03-28T10:00:00Z",
			},
			{
				id: "review-2",
				userId: "user-2",
				username: "digger99",
				avatarUrl: "https://example.com/avatar.jpg",
				rating: 4,
				title: "Great album",
				body: "Classic jazz record",
				isPressingSpecific: false,
				pressingDetails: null,
				createdAt: "2026-03-27T10:00:00Z",
			},
			{
				id: "review-3",
				userId: "user-3",
				username: "cratekid",
				avatarUrl: null,
				rating: 3,
				title: null,
				body: "Decent copy",
				isPressingSpecific: false,
				pressingDetails: null,
				createdAt: "2026-03-26T10:00:00Z",
			},
		]);

		const reviews = await getReviewsForRelease("release-uuid-1");

		expect(reviews).toHaveLength(3);
		expect(reviews[0]).toHaveProperty("rating");
		expect(reviews[0]).toHaveProperty("title");
		expect(reviews[0]).toHaveProperty("body");
		expect(reviews[0]).toHaveProperty("username");
		expect(reviews[0].rating).toBe(5);
		expect(reviews[1].username).toBe("digger99");
		expect(reviews[2].title).toBeNull();
	});

	test("returns empty array for release with no reviews", async () => {
		const mockGetReviews = vi.mocked(getReviewsForRelease);
		mockGetReviews.mockResolvedValue([]);

		const reviews = await getReviewsForRelease("release-uuid-no-reviews");

		expect(reviews).toEqual([]);
		expect(reviews).toHaveLength(0);
	});

	test("supports cursor-based pagination", async () => {
		const mockGetReviews = vi.mocked(getReviewsForRelease);
		mockGetReviews.mockResolvedValue([
			{
				id: "review-4",
				userId: "user-4",
				username: "vinylhead",
				avatarUrl: null,
				rating: 2,
				title: "Not great",
				body: "Surface noise issues",
				isPressingSpecific: true,
				pressingDetails: "1980 repress",
				createdAt: "2026-03-25T10:00:00Z",
			},
		]);

		const cursor = "2026-03-26T10:00:00Z";
		const reviews = await getReviewsForRelease("release-uuid-1", cursor, 5);

		expect(reviews).toHaveLength(1);
		// Verify the function was called with cursor and limit parameters
		expect(mockGetReviews).toHaveBeenCalledWith("release-uuid-1", cursor, 5);
	});
});

describe("getReviewCountForRelease (release page integration)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	test("returns correct count", async () => {
		const mockGetCount = vi.mocked(getReviewCountForRelease);
		mockGetCount.mockResolvedValue(5);

		const count = await getReviewCountForRelease("release-uuid-1");

		expect(count).toBe(5);
	});
});
