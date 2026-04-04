import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock rate limiters
// ---------------------------------------------------------------------------

const mockApiLimit = vi.fn();
const mockTradeLimit = vi.fn();
const mockDiscogsLimit = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: "api",       // sentinel value so safeLimit can identify it
	tradeRateLimit: "trade",
	discogsRateLimit: "discogs",
	// safeLimit(limiter, key, failClosed) — route to the right mock based on limiter sentinel
	safeLimit: vi.fn().mockImplementation(async (limiter: unknown, key: unknown) => {
		if (limiter === "api") return mockApiLimit(key);
		if (limiter === "trade") return mockTradeLimit(key);
		if (limiter === "discogs") return mockDiscogsLimit(key);
		return { success: true };
	}),
}));

// ---------------------------------------------------------------------------
// Supabase auth mock
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: { getUser: mockGetUser },
		storage: {
			from: () => ({
				upload: vi.fn().mockResolvedValue({ error: null }),
				getPublicUrl: () => ({ data: { publicUrl: "http://test.com/img.jpg" } }),
			}),
		},
	})),
}));

// ---------------------------------------------------------------------------
// Supabase admin client mock
// ---------------------------------------------------------------------------
const mockFrom = vi.fn();

function createQueryChain(result: { data?: unknown; error?: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select", "eq", "neq", "single", "maybeSingle", "insert",
		"update", "delete", "in", "or", "order", "limit",
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockFrom,
		auth: { admin: { getUserById: vi.fn() } },
	})),
}));

// ---------------------------------------------------------------------------
// Mock dependencies needed by action modules
// ---------------------------------------------------------------------------

vi.mock("@/actions/social", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/actions/social")>();
	return {
		...actual,
		logActivity: vi.fn(),
	};
});

vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn(),
}));

vi.mock("@/lib/gamification/constants", () => ({
	CONTRIBUTION_POINTS: { trade_completed: 15 },
}));

vi.mock("@/lib/gamification/queries", () => ({
	getGlobalLeaderboard: vi.fn().mockResolvedValue([]),
	getGenreLeaderboard: vi.fn().mockResolvedValue([]),
	getLeaderboardCount: vi.fn().mockResolvedValue(0),
	getGenreLeaderboardCount: vi.fn().mockResolvedValue(0),
}));

// DB mock (thenable chain)
let queryCallCount = 0;
let queryResults: unknown[][] = [];

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select", "from", "where", "orderBy", "limit", "innerJoin",
		"leftJoin", "groupBy", "offset", "selectDistinctOn", "update", "set",
		"delete", "execute",
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		const result = queryResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};
	chain.insert = vi.fn().mockImplementation(() => ({
		values: vi.fn().mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					const result = queryResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				returning: vi.fn().mockImplementation(() => ({
					then: (resolve: (v: unknown) => void) => {
						const result = queryResults[queryCallCount] ?? [];
						queryCallCount++;
						return resolve(result);
					},
				})),
				then: (resolve: (v: unknown) => void) => {
					const result = queryResults[queryCallCount] ?? [];
					queryCallCount++;
					return resolve(result);
				},
			})),
			then: (resolve: (v: unknown) => void) => {
				const result = queryResults[queryCallCount] ?? [];
				queryCallCount++;
				return resolve(result);
			},
		})),
	}));
	return { db: chain };
});

vi.mock("@/lib/db/schema/social", () => ({
	follows: { id: "id", followerId: "follower_id", followingId: "following_id" },
	activityFeed: { userId: "user_id", actionType: "action_type", targetType: "target_type", targetId: "target_id", metadata: "metadata" },
}));
vi.mock("@/lib/db/schema/users", () => ({
	profiles: { id: "id", username: "username", displayName: "display_name", avatarUrl: "avatar_url", updatedAt: "updated_at", onboardingCompleted: "onboarding_completed", holyGrailIds: "holy_grail_ids", coverUrl: "cover_url", coverPositionY: "cover_position_y" },
}));
vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id" },
}));
vi.mock("@/lib/db/schema/releases", () => ({
	releases: { id: "id", title: "title", artist: "artist", year: "year", coverImageUrl: "cover_image_url" },
}));
vi.mock("@/lib/db/schema/groups", () => ({
	groups: { id: "id", slug: "slug", name: "name", memberCount: "member_count" },
	groupMembers: { id: "id", groupId: "group_id", userId: "user_id", role: "role" },
	groupPosts: { id: "id", groupId: "group_id", userId: "user_id", content: "content", releaseId: "release_id", reviewId: "review_id" },
}));
vi.mock("@/lib/db/schema/group-invites", () => ({
	groupInvites: { id: "id", groupId: "group_id", token: "token", createdBy: "created_by", expiresAt: "expires_at" },
}));
vi.mock("@/lib/db/schema/reviews", () => ({
	reviews: { id: "id", userId: "user_id", releaseId: "release_id", rating: "rating", title: "title", body: "body", isPressingSpecific: "is_pressing_specific", pressingDetails: "pressing_details", updatedAt: "updated_at" },
}));
vi.mock("@/lib/db/schema/leads", () => ({
	leads: { userId: "user_id", targetType: "target_type", targetId: "target_id", note: "note", status: "status", updatedAt: "updated_at" },
}));
vi.mock("@/lib/db/schema/sessions", () => ({
	userSessions: { id: "id", userId: "user_id", sessionId: "session_id", deviceInfo: "device_info", ipAddress: "ip_address", createdAt: "created_at", lastSeenAt: "last_seen_at" },
}));

vi.mock("@/lib/community/slugify", () => ({
	slugify: vi.fn().mockReturnValue("test-slug"),
}));
vi.mock("@/lib/community/queries", () => ({
	getGroupPosts: vi.fn(), getGenreGroups: vi.fn(), getMemberGroups: vi.fn(),
	getReviewsForRelease: vi.fn(), getReviewCountForRelease: vi.fn(),
}));
vi.mock("@/lib/social/queries", () => ({
	getGlobalFeed: vi.fn(), getPersonalFeed: vi.fn(),
	getFollowers: vi.fn(), getFollowing: vi.fn(),
}));
vi.mock("@/lib/collection/filters", () => ({
	CONDITION_GRADES: ["M", "NM", "VG+", "VG", "G+", "G", "F", "P"] as const,
}));
vi.mock("@/lib/discogs/client", () => ({
	createDiscogsClient: vi.fn(),
	computeRarityScore: vi.fn().mockReturnValue(1.0),
}));
vi.mock("@/lib/notifications/match", () => ({
	checkWantlistMatches: vi.fn(),
}));
vi.mock("@/lib/notifications/queries", () => ({
	getUnreadCount: vi.fn().mockResolvedValue(0),
	getRecentNotifications: vi.fn().mockResolvedValue([]),
	getNotificationPage: vi.fn().mockResolvedValue([]),
	getPreferences: vi.fn().mockResolvedValue(null),
	upsertPreferences: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/discogs/oauth", () => ({
	getRequestToken: vi.fn(), deleteTokens: vi.fn(),
}));
vi.mock("@/lib/youtube/client", () => ({
	searchYouTube: vi.fn(),
}));
vi.mock("@/lib/discovery/queries", () => ({
	searchRecords: vi.fn().mockResolvedValue([]),
	browseRecords: vi.fn().mockResolvedValue([]),
	getSuggestedRecords: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));
vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({ set: vi.fn() })),
	headers: vi.fn(async () => ({
		get: vi.fn().mockReturnValue("test-agent"),
	})),
}));
vi.mock("next/navigation", () => ({
	redirect: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import actions after mocks
// ---------------------------------------------------------------------------
import { followUser } from "@/actions/social";
import { searchCollectionForShowcase } from "@/actions/profile";
import { loadGlobalLeaderboard } from "@/actions/gamification";
import { markNotificationRead } from "@/actions/notifications";

describe("Server Action Rate Limiting", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
		mockGetUser.mockResolvedValue({
			data: { user: { id: "test-user-id" } },
		});
		mockFrom.mockReturnValue(createQueryChain({ data: null, error: null }));
	});

	describe("social actions use apiRateLimit", () => {
		it("calls apiRateLimit.limit with user.id on followUser", async () => {
			mockApiLimit.mockResolvedValue({ success: true });

			await followUser("a0000000-0000-4000-a000-000000000099");

			expect(mockApiLimit).toHaveBeenCalledWith("test-user-id");
		});

		it("returns error when apiRateLimit denies on followUser", async () => {
			mockApiLimit.mockResolvedValue({ success: false });

			const result = await followUser("a0000000-0000-4000-a000-000000000099");

			expect(result.error).toContain("Too many requests");
		});
	});

	describe("profile actions use apiRateLimit", () => {
		it("calls apiRateLimit.limit on searchCollectionForShowcase", async () => {
			mockApiLimit.mockResolvedValue({ success: true });
			queryResults = [[]];

			await searchCollectionForShowcase("test query");

			expect(mockApiLimit).toHaveBeenCalledWith("test-user-id");
		});

		it("returns empty array when rate limited on searchCollectionForShowcase", async () => {
			mockApiLimit.mockResolvedValue({ success: false });

			const result = await searchCollectionForShowcase("test query");

			expect(result).toEqual([]);
			// Should not proceed to query the database
		});
	});

	describe("gamification actions use apiRateLimit", () => {
		it("calls apiRateLimit.limit on loadGlobalLeaderboard", async () => {
			mockApiLimit.mockResolvedValue({ success: true });

			await loadGlobalLeaderboard();

			expect(mockApiLimit).toHaveBeenCalledWith("test-user-id");
		});

		it("returns empty array when rate limited on loadGlobalLeaderboard", async () => {
			mockApiLimit.mockResolvedValue({ success: false });

			const result = await loadGlobalLeaderboard();

			expect(result).toEqual([]);
		});
	});

	describe("notifications actions use apiRateLimit", () => {
		it("calls apiRateLimit.limit on markNotificationRead", async () => {
			mockApiLimit.mockResolvedValue({ success: true });
			mockFrom.mockReturnValue(
				createQueryChain({ data: { id: "a0000000-0000-4000-a000-000000000011" }, error: null }),
			);

			await markNotificationRead("a0000000-0000-4000-a000-000000000011");

			expect(mockApiLimit).toHaveBeenCalledWith("test-user-id");
		});

		it("returns error when rate limited on markNotificationRead", async () => {
			mockApiLimit.mockResolvedValue({ success: false });

			const result = await markNotificationRead("a0000000-0000-4000-a000-000000000011");

			expect(result.error).toContain("Too many requests");
		});
	});
});
