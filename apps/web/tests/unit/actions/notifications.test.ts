import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_UUID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const USER_ID = "user-notifications-1";

let mockUser: { id: string } | null = { id: USER_ID };

/* ---------- Supabase client mock (auth via createClient) ---------- */
const createClientMock = vi.fn(async () => ({
	auth: {
		getUser: vi.fn(async () => ({
			data: { user: mockUser },
		})),
	},
}));

/* ---------- Supabase admin mock (mutations) ---------- */
let adminSelectResult: { data: unknown; error: unknown } = { data: null, error: null };
let adminUpdateResult: { data: unknown; error: unknown } = { data: null, error: null };
let adminInsertResult: { data: unknown; error: unknown } = { data: null, error: null };

const adminMaybeSingleMock = vi.fn(() => adminUpdateResult);
const adminSelectMock = vi.fn(() => ({ maybeSingle: adminMaybeSingleMock }));
const adminEqChain: ReturnType<typeof vi.fn> = vi.fn(() => ({
	eq: adminEqChain,
	select: adminSelectMock,
}));
const adminUpdateMock: ReturnType<typeof vi.fn> = vi.fn(() => ({ eq: adminEqChain }));

const adminInsertSingleMock = vi.fn(() => adminInsertResult);
const adminInsertSelectMock = vi.fn(() => ({ single: adminInsertSingleMock }));
const adminInsertValuesMock = vi.fn(() => ({ select: adminInsertSelectMock }));

const adminFromMock = vi.fn((table: string) => {
	if (table === "notifications") {
		return { update: adminUpdateMock };
	}
	if (table === "notification_preferences") {
		return { insert: adminInsertValuesMock };
	}
	return {};
});

const createAdminClientMock = vi.fn(() => ({
	from: adminFromMock,
}));

/* ---------- Library query mocks ---------- */
const getNotificationPageMock = vi.fn();
const getRecentNotificationsMock = vi.fn();
const getUnreadCountMock = vi.fn();
const getPreferencesMock = vi.fn();
const upsertPreferencesMock = vi.fn();

/* ---------- Rate limit mock ---------- */
const safeLimitMock = vi.fn(async () => ({ success: true }));

/* ---------- Register mocks ---------- */
vi.mock("@/lib/supabase/server", () => ({
	createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/notifications/queries", () => ({
	getNotificationPage: getNotificationPageMock,
	getRecentNotifications: getRecentNotificationsMock,
	getUnreadCount: getUnreadCountMock,
	getPreferences: getPreferencesMock,
	upsertPreferences: upsertPreferencesMock,
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: "api-rate-limit-key",
	safeLimit: safeLimitMock,
}));

/* ---------- Import actions after mocks are registered ---------- */
const {
	getNotificationsAction,
	getRecentNotificationsAction,
	getUnreadCountAction,
	markNotificationRead,
	markAllRead,
	getPreferencesAction,
	updatePreferencesAction,
} = await import("@/actions/notifications");

/* ---------- Reset between tests ---------- */
beforeEach(() => {
	mockUser = { id: USER_ID };
	adminSelectResult = { data: null, error: null };
	adminUpdateResult = { data: null, error: null };
	adminInsertResult = { data: null, error: null };
	vi.clearAllMocks();

	// Re-wire default chain behavior after clearAllMocks
	adminMaybeSingleMock.mockImplementation(() => adminUpdateResult);
	adminSelectMock.mockImplementation(() => ({ maybeSingle: adminMaybeSingleMock }));
	adminEqChain.mockImplementation(() => ({ eq: adminEqChain, select: adminSelectMock }));
	adminUpdateMock.mockImplementation(() => ({ eq: adminEqChain }));
	adminInsertSingleMock.mockImplementation(() => adminInsertResult);
	adminInsertSelectMock.mockImplementation(() => ({ single: adminInsertSingleMock }));
	adminInsertValuesMock.mockImplementation(() => ({ select: adminInsertSelectMock }));
	adminFromMock.mockImplementation((table: string) => {
		if (table === "notifications") {
			return { update: adminUpdateMock };
		}
		if (table === "notification_preferences") {
			return { insert: adminInsertValuesMock };
		}
		return {};
	});
	safeLimitMock.mockResolvedValue({ success: true });
});

/* ================================================================
   getNotificationsAction
   ================================================================ */
describe("getNotificationsAction", () => {
	it("returns paginated results for authenticated user", async () => {
		const mockPage = { items: [{ id: "n1" }], total: 1, page: 1, pageSize: 20 };
		getNotificationPageMock.mockResolvedValue(mockPage);

		const result = await getNotificationsAction(1);

		expect(getNotificationPageMock).toHaveBeenCalledWith(USER_ID, 1);
		expect(result).toEqual(mockPage);
	});

	it("returns empty result for unauthenticated user", async () => {
		mockUser = null;

		const result = await getNotificationsAction(1);

		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
		expect(getNotificationPageMock).not.toHaveBeenCalled();
	});

	it("returns empty result for invalid page (negative)", async () => {
		const result = await getNotificationsAction(-1);

		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
		expect(getNotificationPageMock).not.toHaveBeenCalled();
	});

	it("returns empty result for invalid page (too large)", async () => {
		const result = await getNotificationsAction(1001);

		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
		expect(getNotificationPageMock).not.toHaveBeenCalled();
	});

	it("returns empty result for non-integer page", async () => {
		const result = await getNotificationsAction(1.5);

		expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
		expect(getNotificationPageMock).not.toHaveBeenCalled();
	});
});

/* ================================================================
   getRecentNotificationsAction
   ================================================================ */
describe("getRecentNotificationsAction", () => {
	it("returns limited results for authenticated user", async () => {
		const mockNotifs = [{ id: "n1" }, { id: "n2" }];
		getRecentNotificationsMock.mockResolvedValue(mockNotifs);

		const result = await getRecentNotificationsAction(5);

		expect(getRecentNotificationsMock).toHaveBeenCalledWith(USER_ID, 5);
		expect(result).toEqual(mockNotifs);
	});

	it("returns empty array for unauthenticated user", async () => {
		mockUser = null;

		const result = await getRecentNotificationsAction(5);

		expect(result).toEqual([]);
		expect(getRecentNotificationsMock).not.toHaveBeenCalled();
	});

	it("returns empty array for invalid limit (zero)", async () => {
		const result = await getRecentNotificationsAction(0);

		expect(result).toEqual([]);
		expect(getRecentNotificationsMock).not.toHaveBeenCalled();
	});

	it("returns empty array for invalid limit (too large)", async () => {
		const result = await getRecentNotificationsAction(51);

		expect(result).toEqual([]);
		expect(getRecentNotificationsMock).not.toHaveBeenCalled();
	});

	it("returns empty array for non-integer limit", async () => {
		const result = await getRecentNotificationsAction(2.7);

		expect(result).toEqual([]);
		expect(getRecentNotificationsMock).not.toHaveBeenCalled();
	});
});

/* ================================================================
   getUnreadCountAction
   ================================================================ */
describe("getUnreadCountAction", () => {
	it("returns unread count for authenticated user", async () => {
		getUnreadCountMock.mockResolvedValue(7);

		const result = await getUnreadCountAction();

		expect(getUnreadCountMock).toHaveBeenCalledWith(USER_ID);
		expect(result).toBe(7);
	});

	it("returns 0 for unauthenticated user", async () => {
		mockUser = null;

		const result = await getUnreadCountAction();

		expect(result).toBe(0);
		expect(getUnreadCountMock).not.toHaveBeenCalled();
	});

	it("returns 0 when query throws", async () => {
		getUnreadCountMock.mockImplementationOnce(() => {
			throw new Error("DB down");
		});

		const result = await getUnreadCountAction();

		expect(result).toBe(0);
	});
});

/* ================================================================
   markNotificationRead
   ================================================================ */
describe("markNotificationRead", () => {
	it("marks notification as read for owner", async () => {
		adminUpdateResult = { data: { id: VALID_UUID }, error: null };

		const result = await markNotificationRead(VALID_UUID);

		expect(result).toEqual({ success: true });
		expect(adminFromMock).toHaveBeenCalledWith("notifications");
		expect(adminUpdateMock).toHaveBeenCalledWith({ read: true });
	});

	it("rejects invalid UUID format", async () => {
		const result = await markNotificationRead("not-a-uuid");

		expect(result).toEqual({ error: "Invalid notification ID" });
		expect(adminFromMock).not.toHaveBeenCalled();
	});

	it("returns error when unauthenticated", async () => {
		mockUser = null;

		const result = await markNotificationRead(VALID_UUID);

		expect(result).toEqual({ error: "Not authenticated" });
		expect(adminFromMock).not.toHaveBeenCalled();
	});

	it("returns error when notification not found (non-owner)", async () => {
		adminUpdateResult = { data: null, error: null };

		const result = await markNotificationRead(VALID_UUID);

		expect(result).toEqual({ error: "Notification not found." });
	});

	it("returns error when database update fails", async () => {
		adminUpdateResult = { data: null, error: { message: "DB error" } };

		const result = await markNotificationRead(VALID_UUID);

		expect(result).toEqual({ error: "Could not mark notification as read." });
	});

	it("returns error when rate limited", async () => {
		safeLimitMock.mockResolvedValue({ success: false });

		const result = await markNotificationRead(VALID_UUID);

		expect(result).toEqual({ error: "Too many requests. Please wait a moment." });
		expect(adminFromMock).not.toHaveBeenCalled();
	});
});

/* ================================================================
   markAllRead
   ================================================================ */
describe("markAllRead", () => {
	it("marks all notifications read for authenticated user", async () => {
		adminUpdateResult = { data: null, error: null };
		// markAllRead uses .eq().eq() without .select()/.maybeSingle(), so we need the eq chain
		// to return an object with just { error }. Override the chain for this specific flow.
		const eqFinalMock = vi.fn(() => ({ error: null }));
		const eqFirstMock = vi.fn(() => ({ eq: eqFinalMock }));
		adminUpdateMock.mockImplementation(() => ({ eq: eqFirstMock }));

		const result = await markAllRead();

		expect(result).toEqual({ success: true });
		expect(adminFromMock).toHaveBeenCalledWith("notifications");
		expect(adminUpdateMock).toHaveBeenCalledWith({ read: true });
	});

	it("returns error when unauthenticated", async () => {
		mockUser = null;

		const result = await markAllRead();

		expect(result).toEqual({ error: "Not authenticated" });
		expect(adminFromMock).not.toHaveBeenCalled();
	});

	it("returns error when database update fails", async () => {
		const eqFinalMock = vi.fn(() => ({ error: { message: "DB error" } }));
		const eqFirstMock = vi.fn(() => ({ eq: eqFinalMock }));
		adminUpdateMock.mockImplementation(() => ({ eq: eqFirstMock }));

		const result = await markAllRead();

		expect(result).toEqual({ error: "Could not mark notifications as read." });
	});

	it("returns error when rate limited", async () => {
		safeLimitMock.mockResolvedValue({ success: false });

		const result = await markAllRead();

		expect(result).toEqual({ error: "Too many requests. Please wait a moment." });
		expect(adminFromMock).not.toHaveBeenCalled();
	});
});

/* ================================================================
   getPreferencesAction
   ================================================================ */
describe("getPreferencesAction", () => {
	it("returns existing preferences", async () => {
		const mockPrefs = { user_id: USER_ID, wantlist_match_inapp: true };
		getPreferencesMock.mockResolvedValue(mockPrefs);

		const result = await getPreferencesAction();

		expect(getPreferencesMock).toHaveBeenCalledWith(USER_ID);
		expect(result).toEqual(mockPrefs);
		expect(adminFromMock).not.toHaveBeenCalled();
	});

	it("lazy-creates default preferences when none exist", async () => {
		getPreferencesMock.mockResolvedValue(null);
		const defaultPrefs = { user_id: USER_ID, wantlist_match_inapp: true };
		adminInsertResult = { data: defaultPrefs, error: null };

		const result = await getPreferencesAction();

		expect(getPreferencesMock).toHaveBeenCalledWith(USER_ID);
		expect(adminFromMock).toHaveBeenCalledWith("notification_preferences");
		expect(adminInsertValuesMock).toHaveBeenCalledWith({ user_id: USER_ID });
		expect(result).toEqual(defaultPrefs);
	});

	it("returns null when unauthenticated", async () => {
		mockUser = null;

		const result = await getPreferencesAction();

		expect(result).toBeNull();
		expect(getPreferencesMock).not.toHaveBeenCalled();
	});

	it("returns null when lazy-create fails", async () => {
		getPreferencesMock.mockResolvedValue(null);
		adminInsertResult = { data: null, error: { message: "insert error" } };

		const result = await getPreferencesAction();

		expect(result).toBeNull();
	});
});

/* ================================================================
   updatePreferencesAction
   ================================================================ */
describe("updatePreferencesAction", () => {
	it("updates preferences with valid input", async () => {
		upsertPreferencesMock.mockResolvedValue(undefined);

		const result = await updatePreferencesAction({
			wantlistMatchInapp: false,
			pushEnabled: true,
		});

		expect(result).toEqual({ success: true });
		expect(upsertPreferencesMock).toHaveBeenCalledWith(USER_ID, {
			wantlistMatchInapp: false,
			pushEnabled: true,
		});
	});

	it("returns error when unauthenticated", async () => {
		mockUser = null;

		const result = await updatePreferencesAction({ pushEnabled: true });

		expect(result).toEqual({ error: "Not authenticated" });
		expect(upsertPreferencesMock).not.toHaveBeenCalled();
	});

	it("rejects invalid input (wrong type for boolean field)", async () => {
		// @ts-expect-error - intentionally passing wrong type for test
		const result = await updatePreferencesAction({ pushEnabled: "yes" });

		expect(result).toEqual({ error: "Invalid preferences data" });
		expect(upsertPreferencesMock).not.toHaveBeenCalled();
	});

	it("returns error when rate limited", async () => {
		safeLimitMock.mockResolvedValue({ success: false });

		const result = await updatePreferencesAction({ pushEnabled: true });

		expect(result).toEqual({ error: "Too many requests. Please wait a moment." });
		expect(upsertPreferencesMock).not.toHaveBeenCalled();
	});

	it("returns error when upsert throws", async () => {
		upsertPreferencesMock.mockRejectedValue(new Error("DB error"));

		const result = await updatePreferencesAction({ pushEnabled: true });

		expect(result).toEqual({ error: "Failed to update preferences. Please try again." });
	});

	it("accepts empty preferences object", async () => {
		upsertPreferencesMock.mockResolvedValue(undefined);

		const result = await updatePreferencesAction({});

		expect(result).toEqual({ success: true });
	});
});
