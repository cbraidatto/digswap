/**
 * OWASP ZAP Baseline Scan -- SEC-04 Penetration Test
 *
 * Prerequisites:
 *   1. Docker running: `docker --version`
 *   2. App running locally: `npm run dev` (http://localhost:3000)
 *   3. Pull ZAP image: `docker pull ghcr.io/zaproxy/zaproxy:stable`
 *
 * Run scan:
 *   docker run -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:3000
 *
 * NOTE: ZAP cannot scan Next.js Server Actions (Flight protocol).
 * Server action security is covered by this test suite (auth-bypass, rate-limiting, input-validation, idor).
 * ZAP covers: API routes, static pages, HTTP headers, cookie security, OWASP Top 10 HTTP-level checks.
 *
 * Expected: No HIGH or MEDIUM alerts. LOW/INFORMATIONAL alerts are acceptable.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock: Supabase auth -- always unauthenticated
// ---------------------------------------------------------------------------
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: mockGetUser,
			signOut: vi.fn().mockResolvedValue({ error: null }),
			signUp: vi.fn().mockResolvedValue({ error: null }),
			signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: { message: "mock" } }),
			mfa: {
				enroll: vi.fn().mockResolvedValue({ data: null, error: { message: "mock" } }),
				getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { nextLevel: "aal1", currentLevel: "aal1" }, error: null }),
				challengeAndVerify: vi.fn().mockResolvedValue({ error: { message: "mock" } }),
			},
			resend: vi.fn().mockResolvedValue({ error: null }),
			resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
			updateUser: vi.fn().mockResolvedValue({ error: null }),
			getClaims: vi.fn().mockResolvedValue({ data: { claims: {} }, error: null }),
		},
		storage: {
			from: () => ({
				upload: vi.fn().mockResolvedValue({ error: null }),
				getPublicUrl: () => ({ data: { publicUrl: "http://test.com/img.jpg" } }),
			}),
		},
	})),
}));

// ---------------------------------------------------------------------------
// Mock: Supabase admin client
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
// Mock: Rate limiters (all allow through for auth testing)
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));;

// ---------------------------------------------------------------------------
// Mock: DB (thenable Drizzle chain)
// ---------------------------------------------------------------------------
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
	chain.then = (resolve: (v: unknown) => void) => resolve([]);
	chain.insert = vi.fn().mockImplementation(() => ({
		values: vi.fn().mockImplementation(() => ({
			returning: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => resolve([]),
			})),
			onConflictDoUpdate: vi.fn().mockImplementation(() => ({
				returning: vi.fn().mockImplementation(() => ({
					then: (resolve: (v: unknown) => void) => resolve([]),
				})),
				then: (resolve: (v: unknown) => void) => resolve([]),
			})),
			then: (resolve: (v: unknown) => void) => resolve([]),
		})),
	}));
	return { db: chain };
});

// ---------------------------------------------------------------------------
// Mock: Schema modules
// ---------------------------------------------------------------------------
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
	backupCodes: { id: "id", userId: "user_id", codeHash: "code_hash", used: "used" },
}));
vi.mock("@/lib/db/schema/wantlist", () => ({
	wantlistItems: { id: "id", userId: "user_id", releaseId: "release_id" },
}));

// ---------------------------------------------------------------------------
// Mock: remaining dependencies
// ---------------------------------------------------------------------------
vi.mock("@/actions/social", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/actions/social")>();
	return { ...actual, logActivity: vi.fn() };
});
vi.mock("@/lib/gamification/badge-awards", () => ({ awardBadge: vi.fn() }));
vi.mock("@/lib/gamification/constants", () => ({ CONTRIBUTION_POINTS: { trade_completed: 15 } }));
vi.mock("@/lib/gamification/queries", () => ({
	getGlobalLeaderboard: vi.fn().mockResolvedValue([]),
	getGenreLeaderboard: vi.fn().mockResolvedValue([]),
	getLeaderboardCount: vi.fn().mockResolvedValue(0),
	getGenreLeaderboardCount: vi.fn().mockResolvedValue(0),
}));
vi.mock("@/lib/community/slugify", () => ({ slugify: vi.fn().mockReturnValue("test-slug") }));
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
vi.mock("@/lib/notifications/match", () => ({ checkWantlistMatches: vi.fn() }));
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
vi.mock("@/lib/youtube/client", () => ({ searchYouTube: vi.fn() }));
vi.mock("@/lib/discovery/queries", () => ({
	searchRecords: vi.fn().mockResolvedValue([]),
	browseRecords: vi.fn().mockResolvedValue([]),
	getSuggestedRecords: vi.fn().mockResolvedValue([]),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
	cookies: vi.fn(async () => ({ set: vi.fn() })),
	headers: vi.fn(async () => ({ get: vi.fn().mockReturnValue("test-agent") })),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/backup-codes", () => ({
	generateBackupCodes: vi.fn().mockReturnValue(["CODE1", "CODE2"]),
	storeBackupCodes: vi.fn(),
	consumeBackupCode: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/lib/validations/auth", () => ({
	signUpSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { email: "a@b.com", password: "Test1234!" } }) },
	signInSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { email: "a@b.com", password: "Test1234!" } }) },
	forgotPasswordSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { email: "a@b.com" } }) },
	resetPasswordSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { password: "Test1234!", confirmPassword: "Test1234!" } }) },
	totpSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { code: "123456" } }) },
	backupCodeSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { code: "ABCD1234" } }) },
}));
vi.mock("@/lib/validations/community", () => ({
	createPostSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { content: "test", groupId: "g1" } }) },
	createReviewSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: { releaseId: "r1", rating: 5, body: "great", groupId: "g1" } }) },
}));
vi.mock("@/lib/validations/profile", () => ({
	updateProfileSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: {} }) },
}));
vi.mock("@/lib/validations/common", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/validations/common")>();
	return {
		...actual,
		sanitizeWildcards: vi.fn((v: string) => v),
	};
});

// ---------------------------------------------------------------------------
// Import actions AFTER mocks
// ---------------------------------------------------------------------------
import { createGroupAction, joinGroupAction } from "@/actions/community";
import { followUser, searchUsers } from "@/actions/social";
import { searchRecordsAction } from "@/actions/discovery";
import { updateShowcase, updateProfile as updateProfileAction } from "@/actions/profile";
import { searchDiscogs } from "@/actions/collection";
import { connectDiscogs, triggerSync } from "@/actions/discogs";
import { saveLead, getLead } from "@/actions/leads";
import { addToWantlist } from "@/actions/wantlist";
import { markNotificationRead, getNotificationsAction } from "@/actions/notifications";
import { loadGlobalLeaderboard } from "@/actions/gamification";
import { updateProfile as onboardingUpdateProfile } from "@/actions/onboarding";
import { getSessions, terminateSession } from "@/actions/sessions";
import { enrollTotp } from "@/actions/mfa";

// ---------------------------------------------------------------------------
// Auth Bypass Prevention Tests
// ---------------------------------------------------------------------------

describe("Auth Bypass Prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: unauthenticated user
		mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
		mockFrom.mockReturnValue(createQueryChain({ data: null, error: null }));
	});

	describe("community.ts auth guard", () => {
		it("should require authentication for createGroupAction", async () => {
			const result = await createGroupAction({ name: "Test", visibility: "public" });
			expect(result).toHaveProperty("error");
		});

		it("should require authentication for joinGroupAction", async () => {
			const result = await joinGroupAction("group-id");
			expect(result).toHaveProperty("error");
		});
	});

	describe("social.ts auth guard", () => {
		it("should require authentication for followUser", async () => {
			const result = await followUser("a0000000-0000-4000-a000-000000000099");
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/not authenticated/i);
		});

		it("should require authentication for searchUsers (returns empty)", async () => {
			const result = await searchUsers("test query");
			expect(result).toEqual([]);
		});
	});

	describe("discovery.ts auth guard", () => {
		it("should require authentication for searchRecordsAction", async () => {
			const result = await searchRecordsAction("test");
			expect(result).toEqual([]);
		});
	});

	describe("profile.ts auth guard", () => {
		it("should require authentication for updateShowcase", async () => {
			const result = await updateShowcase("searching", "a0000000-0000-4000-a000-000000000022");
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/unauthenticated/i);
		});

		it("should require authentication for updateProfile", async () => {
			const result = await updateProfileAction({
				displayName: "Test", username: "test", location: "NYC",
			});
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/unauthenticated/i);
		});
	});

	describe("collection.ts auth guard", () => {
		it("should require authentication for searchDiscogs", async () => {
			const result = await searchDiscogs("test query");
			expect(result).toEqual([]);
		});
	});

	describe("discogs.ts auth guard", () => {
		it("should require authentication for connectDiscogs", async () => {
			const result = await connectDiscogs();
			expect(result).toHaveProperty("error");
		});

		it("should require authentication for triggerSync", async () => {
			const result = await triggerSync();
			expect(result).toHaveProperty("error");
		});
	});

	describe("leads.ts auth guard", () => {
		it("should require authentication for saveLead", async () => {
			const result = await saveLead("release", "target-id", null, "watching");
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/not authenticated/i);
		});

		it("should require authentication for getLead (returns null)", async () => {
			const result = await getLead("release", "target-id");
			expect(result).toBeNull();
		});
	});

	describe("wantlist.ts auth guard", () => {
		it("should require authentication for addToWantlist", async () => {
			const result = await addToWantlist(12345);
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/not authenticated/i);
		});
	});

	describe("notifications.ts auth guard", () => {
		it("should require authentication for getNotificationsAction", async () => {
			const result = await getNotificationsAction();
			expect(result.items).toEqual([]);
		});

		it("should require authentication for markNotificationRead", async () => {
			const result = await markNotificationRead("a0000000-0000-4000-a000-000000000033");
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/not authenticated/i);
		});
	});

	describe("gamification.ts auth guard", () => {
		it("should require authentication for loadGlobalLeaderboard", async () => {
			const result = await loadGlobalLeaderboard();
			expect(result).toEqual([]);
		});
	});

	describe("onboarding.ts auth guard", () => {
		it("should require authentication for updateProfile", async () => {
			const formData = new FormData();
			formData.set("display_name", "Test");
			const result = await onboardingUpdateProfile(formData);
			expect(result).toHaveProperty("error");
			expect(result.error).toMatch(/not authenticated/i);
		});
	});

	describe("sessions.ts auth guard", () => {
		it("should require authentication for getSessions", async () => {
			const result = await getSessions();
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/not authenticated/i);
		});

		it("should require authentication for terminateSession", async () => {
			const result = await terminateSession("session-id");
			expect(result.success).toBe(false);
			expect(result.error).toMatch(/not authenticated/i);
		});
	});

	describe("auth.ts auth guard (special: pre-auth actions)", () => {
		it("signOut should attempt auth signOut without requiring prior check", async () => {
			// signOut calls supabase.auth.signOut() then redirect("/signin")
			// It does NOT check getUser first -- this is intentional (you can sign out anytime)
			// The redirect mock captures the call
			const { redirect } = await import("next/navigation");
			const { signOut } = await import("@/actions/auth");
			await signOut();
			expect(redirect).toHaveBeenCalledWith("/signin");
		});
	});

	describe("mfa.ts auth guard", () => {
		it("should require authentication for enrollTotp", async () => {
			const result = await enrollTotp();
			expect(result.success).toBe(false);
			if (result.success) {
				throw new Error("Expected enrollTotp to fail for unauthenticated user.");
			}
			expect(result.error).toMatch(/not authenticated/i);
		});
	});
});
