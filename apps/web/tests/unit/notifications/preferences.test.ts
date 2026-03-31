import { describe, test, expect, vi, beforeEach } from "vitest";

// Track call count to return different results for sequential queries
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
		"offset",
		"innerJoin",
		"leftJoin",
		"groupBy",
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

vi.mock("@/lib/db/schema/notifications", () => ({
	notifications: {
		id: "id",
		userId: "user_id",
		type: "type",
		title: "title",
		body: "body",
		link: "link",
		read: "read",
		createdAt: "created_at",
	},
	notificationPreferences: {
		id: "id",
		userId: "user_id",
		wantlistMatchInapp: "wantlist_match_inapp",
		wantlistMatchEmail: "wantlist_match_email",
		tradeRequestInapp: "trade_request_inapp",
		tradeRequestEmail: "trade_request_email",
		tradeCompletedInapp: "trade_completed_inapp",
		rankingChangeInapp: "ranking_change_inapp",
		newBadgeInapp: "new_badge_inapp",
		pushEnabled: "push_enabled",
		createdAt: "created_at",
		updatedAt: "updated_at",
	},
}));

// Mock admin client for upsertPreferences
const mockUpsert = vi.fn();
const mockAdminFrom = vi.fn();
const mockAdminClient = {
	from: mockAdminFrom,
};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => mockAdminClient,
}));

import {
	getUnreadCount,
	getPreferences,
	upsertPreferences,
} from "@/lib/notifications/queries";

describe("notification queries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		queryCallCount = 0;
		queryResults = [];
	});

	describe("getPreferences", () => {
		test("returns row when preferences exist", async () => {
			const mockPrefs = {
				id: "pref-1",
				userId: "user-1",
				wantlistMatchInapp: true,
				wantlistMatchEmail: true,
			};

			queryResults = [[mockPrefs]];

			const result = await getPreferences("user-1");

			expect(result).toEqual(mockPrefs);
		});

		test("returns null when no preferences row exists", async () => {
			queryResults = [[]];

			const result = await getPreferences("user-1");

			expect(result).toBeNull();
		});
	});

	describe("upsertPreferences", () => {
		test("creates new row with defaults via upsert", async () => {
			const mockData = {
				id: "pref-1",
				user_id: "user-1",
				wantlist_match_inapp: true,
				wantlist_match_email: false,
			};

			// Create chain for upsert
			const chain: Record<string, unknown> = {};
			chain.upsert = vi.fn().mockReturnValue(chain);
			chain.select = vi.fn().mockReturnValue(chain);
			chain.single = vi.fn().mockReturnValue(chain);
			chain.then = (resolve: (v: unknown) => void) =>
				resolve({ data: mockData, error: null });

			mockAdminFrom.mockReturnValue(chain);

			const result = await upsertPreferences("user-1", {
				wantlistMatchEmail: false,
			});

			expect(result).toEqual(mockData);
			expect(mockAdminFrom).toHaveBeenCalledWith(
				"notification_preferences",
			);
		});

		test("updates existing row via upsert", async () => {
			const mockData = {
				id: "pref-1",
				user_id: "user-1",
				wantlist_match_inapp: false,
				wantlist_match_email: true,
			};

			const chain: Record<string, unknown> = {};
			chain.upsert = vi.fn().mockReturnValue(chain);
			chain.select = vi.fn().mockReturnValue(chain);
			chain.single = vi.fn().mockReturnValue(chain);
			chain.then = (resolve: (v: unknown) => void) =>
				resolve({ data: mockData, error: null });

			mockAdminFrom.mockReturnValue(chain);

			const result = await upsertPreferences("user-1", {
				wantlistMatchInapp: false,
			});

			expect(result).toEqual(mockData);
		});
	});

	describe("getUnreadCount", () => {
		test("returns correct count", async () => {
			queryResults = [[{ count: 5 }]];

			const result = await getUnreadCount("user-1");

			expect(result).toBe(5);
		});

		test("returns 0 when no unread notifications", async () => {
			queryResults = [[{ count: 0 }]];

			const result = await getUnreadCount("user-1");

			expect(result).toBe(0);
		});
	});
});
