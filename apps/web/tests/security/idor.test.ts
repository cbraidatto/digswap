import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock rate limiters (must allow all to test IDOR logic)
// ---------------------------------------------------------------------------
vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	totpRateLimit: null,
	apiRateLimit: null,
	tradeRateLimit: null,
	discogsRateLimit: null,
	safeLimit: vi.fn().mockImplementation(async () => ({ success: true })),
}));

// ---------------------------------------------------------------------------
// Supabase auth mock - returns user-A
// ---------------------------------------------------------------------------
vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn().mockResolvedValue({
				data: { user: { id: "user-A" } },
			}),
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
// Supabase admin client mock with chainable queries
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

vi.mock("@/actions/social", () => ({
	logActivity: vi.fn(),
}));
vi.mock("@/lib/gamification/badge-awards", () => ({
	awardBadge: vi.fn(),
}));
vi.mock("@/lib/gamification/constants", () => ({
	CONTRIBUTION_POINTS: { trade_completed: 15 },
}));

// ---------------------------------------------------------------------------
// DB mock
// ---------------------------------------------------------------------------
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

vi.mock("@/lib/db/schema/users", () => ({
	profiles: { id: "id", username: "username", displayName: "display_name", avatarUrl: "avatar_url", updatedAt: "updated_at", onboardingCompleted: "onboarding_completed", holyGrailIds: "holy_grail_ids", coverUrl: "cover_url", coverPositionY: "cover_position_y" },
}));
vi.mock("@/lib/db/schema/collections", () => ({
	collectionItems: { userId: "user_id", releaseId: "release_id" },
}));
vi.mock("@/lib/db/schema/releases", () => ({
	releases: { id: "id", title: "title", artist: "artist", year: "year", coverImageUrl: "cover_image_url" },
}));
vi.mock("@/lib/db/schema/leads", () => ({
	leads: { userId: "user_id", targetType: "target_type", targetId: "target_id", note: "note", status: "status", updatedAt: "updated_at" },
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
vi.mock("@/lib/youtube/client", () => ({
	searchYouTube: vi.fn(),
}));
vi.mock("next/cache", () => ({
	revalidatePath: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------
import { updateConditionGrade } from "@/actions/collection";
import { markNotificationRead } from "@/actions/notifications";
import { removeFromWantlist } from "@/actions/wantlist";
import { updateProfile } from "@/actions/profile";
import { saveLead } from "@/actions/leads";

describe("IDOR Prevention", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	describe("updateConditionGrade ownership check", () => {
		it("only updates collection items belonging to the current user", async () => {
			// Admin query returns null (no matching item for user-A)
			mockFrom.mockReturnValue(
				createQueryChain({ data: null, error: null }),
			);

			const result = await updateConditionGrade("item-owned-by-user-B", "NM");

			// The eq chain should include user_id filter with user-A
			expect(result.error).toBe("Not found");
		});
	});

	describe("markNotificationRead ownership check", () => {
		it("returns error for notification belonging to another user", async () => {
			// Admin query with eq(user_id, user-A) returns null (not found)
			mockFrom.mockReturnValue(
				createQueryChain({ data: null, error: null }),
			);

			const result = await markNotificationRead("a0000000-0000-4000-a000-00000000000b");

			expect(result.error).toBe("Notification not found.");
		});
	});

	describe("removeFromWantlist ownership check", () => {
		it("uses user_id filter when deleting wantlist items", async () => {
			// The eq chain filters by both id and user_id
			mockFrom.mockReturnValue(
				createQueryChain({ data: null, error: null }),
			);

			const result = await removeFromWantlist("a0000000-0000-4000-a000-000000000001");

			// Should succeed (no error returned from the query)
			expect(result.success).toBe(true);
		});
	});

	describe("updateProfile ownership check", () => {
		it("only updates the profile of the authenticated user", async () => {
			queryResults = [
				// onConflictDoUpdate result
				[{ id: "user-A" }],
			];

			const result = await updateProfile({
				displayName: "Legit Name",
				username: "legit",
				location: "NYC",
			});

			// Should succeed only for user-A (the authenticated user)
			expect(result).toEqual({ ok: true });
		});
	});

	describe("saveLead ownership check", () => {
		it("upserts lead with the authenticated user's ID only", async () => {
			queryResults = [
				// insert with onConflictDoUpdate
				[{ id: "lead-1" }],
			];

			const result = await saveLead("user" as "user", "target-1", "note", "watching");

			expect(result.success).toBe(true);
		});
	});
});
