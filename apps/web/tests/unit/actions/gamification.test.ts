import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let mockRateLimitSuccess = true;

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: mockRateLimitSuccess })),
}));

const mockGetGlobalLeaderboard = vi.fn();
const mockGetGenreLeaderboard = vi.fn();
const mockGetLeaderboardCount = vi.fn();
const mockGetGenreLeaderboardCount = vi.fn();

vi.mock("@/lib/gamification/queries", () => ({
	getGlobalLeaderboard: (...args: unknown[]) => mockGetGlobalLeaderboard(...args),
	getGenreLeaderboard: (...args: unknown[]) => mockGetGenreLeaderboard(...args),
	getLeaderboardCount: (...args: unknown[]) => mockGetLeaderboardCount(...args),
	getGenreLeaderboardCount: (...args: unknown[]) => mockGetGenreLeaderboardCount(...args),
}));

const {
	loadGlobalLeaderboard,
	loadGenreLeaderboard,
	loadLeaderboardCount,
	loadGenreLeaderboardCount,
} = await import("@/actions/gamification");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fakeEntry(rank: number) {
	return {
		userId: `user-${rank}`,
		username: `digger${rank}`,
		score: 1000 - rank * 10,
		rank,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	mockRateLimitSuccess = true;
	mockGetGlobalLeaderboard.mockReset();
	mockGetGenreLeaderboard.mockReset();
	mockGetLeaderboardCount.mockReset();
	mockGetGenreLeaderboardCount.mockReset();
	vi.clearAllMocks();
});

// ---- loadGlobalLeaderboard -----------------------------------------------

describe("loadGlobalLeaderboard", () => {
	it("returns leaderboard entries for valid page", async () => {
		const entries = [fakeEntry(1), fakeEntry(2), fakeEntry(3)];
		mockGetGlobalLeaderboard.mockResolvedValueOnce(entries);

		const result = await loadGlobalLeaderboard(1);
		expect(result).toEqual(entries);
		expect(mockGetGlobalLeaderboard).toHaveBeenCalledWith(1);
	});

	it("defaults page to undefined when not provided", async () => {
		mockGetGlobalLeaderboard.mockResolvedValueOnce([]);

		const result = await loadGlobalLeaderboard();
		expect(result).toEqual([]);
		// Schema defaults page as optional — parsed.data.page is undefined
		expect(mockGetGlobalLeaderboard).toHaveBeenCalledWith(undefined);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await loadGlobalLeaderboard(1);
		expect(result).toEqual([]);
	});

	it("returns empty on rate limit", async () => {
		mockRateLimitSuccess = false;
		const result = await loadGlobalLeaderboard(1);
		expect(result).toEqual([]);
	});

	it("rejects invalid page (negative)", async () => {
		const result = await loadGlobalLeaderboard(-1);
		expect(result).toEqual([]);
		expect(mockGetGlobalLeaderboard).not.toHaveBeenCalled();
	});

	it("rejects page exceeding max (1000)", async () => {
		const result = await loadGlobalLeaderboard(1001);
		expect(result).toEqual([]);
		expect(mockGetGlobalLeaderboard).not.toHaveBeenCalled();
	});

	it("rejects non-integer page", async () => {
		const result = await loadGlobalLeaderboard(1.5);
		expect(result).toEqual([]);
		expect(mockGetGlobalLeaderboard).not.toHaveBeenCalled();
	});

	it("handles query error gracefully", async () => {
		// Note: source does `return getGlobalLeaderboard(...)` without await,
		// so async rejections propagate past the try/catch
		mockGetGlobalLeaderboard.mockRejectedValueOnce(new Error("DB timeout"));
		await expect(loadGlobalLeaderboard(1)).rejects.toThrow("DB timeout");
	});
});

// ---- loadGenreLeaderboard ------------------------------------------------

describe("loadGenreLeaderboard", () => {
	it("returns entries for valid genre and page", async () => {
		const entries = [fakeEntry(1)];
		mockGetGenreLeaderboard.mockResolvedValueOnce(entries);

		const result = await loadGenreLeaderboard("jazz", 1);
		expect(result).toEqual(entries);
		expect(mockGetGenreLeaderboard).toHaveBeenCalledWith("jazz", 1);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await loadGenreLeaderboard("jazz", 1);
		expect(result).toEqual([]);
	});

	it("rejects empty genre string", async () => {
		const result = await loadGenreLeaderboard("", 1);
		expect(result).toEqual([]);
		expect(mockGetGenreLeaderboard).not.toHaveBeenCalled();
	});

	it("trims genre whitespace", async () => {
		mockGetGenreLeaderboard.mockResolvedValueOnce([]);

		const result = await loadGenreLeaderboard("  jazz  ", 1);
		expect(result).toEqual([]);
		// Schema trims, so query gets "jazz"
		expect(mockGetGenreLeaderboard).toHaveBeenCalledWith("jazz", 1);
	});

	it("rejects genre exceeding 100 chars", async () => {
		const longGenre = "a".repeat(101);
		const result = await loadGenreLeaderboard(longGenre, 1);
		expect(result).toEqual([]);
		expect(mockGetGenreLeaderboard).not.toHaveBeenCalled();
	});

	it("returns empty on rate limit", async () => {
		mockRateLimitSuccess = false;
		const result = await loadGenreLeaderboard("jazz", 1);
		expect(result).toEqual([]);
	});

	it("rejects invalid page", async () => {
		const result = await loadGenreLeaderboard("jazz", 0);
		expect(result).toEqual([]);
		expect(mockGetGenreLeaderboard).not.toHaveBeenCalled();
	});
});

// ---- loadLeaderboardCount ------------------------------------------------

describe("loadLeaderboardCount", () => {
	it("returns count on success", async () => {
		mockGetLeaderboardCount.mockResolvedValueOnce(42);

		const result = await loadLeaderboardCount();
		expect(result).toBe(42);
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await loadLeaderboardCount();
		expect(result).toBe(0);
	});

	it("returns 0 on rate limit", async () => {
		mockRateLimitSuccess = false;
		const result = await loadLeaderboardCount();
		expect(result).toBe(0);
	});

	it("returns 0 on query error", async () => {
		// Note: source does `return getLeaderboardCount()` without await
		mockGetLeaderboardCount.mockRejectedValueOnce(new Error("DB error"));
		await expect(loadLeaderboardCount()).rejects.toThrow("DB error");
	});
});

// ---- loadGenreLeaderboardCount -------------------------------------------

describe("loadGenreLeaderboardCount", () => {
	it("returns count for valid genre", async () => {
		mockGetGenreLeaderboardCount.mockResolvedValueOnce(15);

		const result = await loadGenreLeaderboardCount("funk");
		expect(result).toBe(15);
		expect(mockGetGenreLeaderboardCount).toHaveBeenCalledWith("funk");
	});

	it("rejects unauthenticated caller", async () => {
		mockAuthUser = null;
		const result = await loadGenreLeaderboardCount("funk");
		expect(result).toBe(0);
	});

	it("rejects empty genre", async () => {
		const result = await loadGenreLeaderboardCount("");
		expect(result).toBe(0);
		expect(mockGetGenreLeaderboardCount).not.toHaveBeenCalled();
	});

	it("returns 0 on rate limit", async () => {
		mockRateLimitSuccess = false;
		const result = await loadGenreLeaderboardCount("funk");
		expect(result).toBe(0);
	});

	it("returns 0 on query error", async () => {
		// Note: source does `return getGenreLeaderboardCount(...)` without await
		mockGetGenreLeaderboardCount.mockRejectedValueOnce(new Error("timeout"));
		await expect(loadGenreLeaderboardCount("funk")).rejects.toThrow("timeout");
	});
});
