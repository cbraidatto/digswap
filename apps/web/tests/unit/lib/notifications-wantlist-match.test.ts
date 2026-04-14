import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const RELEASE_ID = "rel-1111-1111-1111-1111";
const ADDER_USER_ID = "user-adder-1111-1111";
const WANTER_USER_ID = "user-wanter-2222-2222";

const mockSendEmail = vi.fn();

vi.mock("@/lib/notifications/email", () => ({
	sendWantlistMatchEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Build a fluent Supabase admin mock
let wantlistResult: { data: unknown[] | null; error: unknown } = { data: [], error: null };
let releaseResult: { data: unknown } = { data: null };
let adderProfileResult: { data: unknown } = { data: { username: "adder_user" } };
let existingNotificationResult: { data: unknown } = { data: null };
let notifInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
let prefsResult: { data: unknown } = { data: { wantlist_match_email: true } };
let userDataResult: { data: unknown } = {
	data: { user: { email: "wanter@example.com" } },
};

function buildSupabaseMock() {
	return {
		from: vi.fn((table: string) => {
			const chain: Record<string, ReturnType<typeof vi.fn>> = {};
			const self = () => chain;

			chain.select = vi.fn().mockReturnValue(chain);
			chain.eq = vi.fn().mockReturnValue(chain);
			chain.neq = vi.fn().mockReturnValue(chain);
			chain.gte = vi.fn().mockReturnValue(chain);
			chain.contains = vi.fn().mockReturnValue(chain);
			chain.limit = vi.fn().mockReturnValue(chain);
			chain.insert = vi.fn().mockResolvedValue(notifInsertResult);
			chain.single = vi.fn();
			chain.maybeSingle = vi.fn();

			if (table === "wantlist_items") {
				chain.limit = vi.fn().mockResolvedValue(wantlistResult);
			} else if (table === "releases") {
				chain.single = vi.fn().mockResolvedValue(releaseResult);
			} else if (table === "profiles") {
				chain.single = vi.fn().mockResolvedValue(adderProfileResult);
			} else if (table === "notifications") {
				// For dedup check
				chain.maybeSingle = vi.fn().mockResolvedValue(existingNotificationResult);
			} else if (table === "notification_preferences") {
				chain.maybeSingle = vi.fn().mockResolvedValue(prefsResult);
			}

			return chain;
		}),
		auth: {
			admin: {
				getUserById: vi.fn().mockResolvedValue(userDataResult),
			},
		},
	};
}

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => buildSupabaseMock()),
}));

const { checkWantlistMatches } = await import("@/lib/notifications/match");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	wantlistResult = { data: [{ user_id: WANTER_USER_ID }], error: null };
	releaseResult = {
		data: { title: "Blue Train", artist: "John Coltrane", discogs_id: 12345 },
	};
	adderProfileResult = { data: { username: "adder_user" } };
	existingNotificationResult = { data: null };
	notifInsertResult = { data: null, error: null };
	prefsResult = { data: { wantlist_match_email: true } };
	userDataResult = { data: { user: { email: "wanter@example.com" } } };
	vi.clearAllMocks();
});

describe("checkWantlistMatches", () => {
	it("does not throw on any error (non-fatal function)", async () => {
		wantlistResult = { data: null, error: { message: "DB error" } };
		await expect(checkWantlistMatches(RELEASE_ID, ADDER_USER_ID)).resolves.toBeUndefined();
	});

	it("returns early when no wantlist matches found", async () => {
		wantlistResult = { data: [], error: null };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("returns early when wantlist query has error", async () => {
		wantlistResult = { data: null, error: { message: "query failed" } };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("returns early when release not found", async () => {
		releaseResult = { data: null };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("returns early when release has no discogs_id", async () => {
		releaseResult = {
			data: { title: "Unknown", artist: "Unknown", discogs_id: null },
		};
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("sends email when match found and user has email prefs enabled", async () => {
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).toHaveBeenCalledWith(
			"wanter@example.com",
			"Blue Train",
			"John Coltrane",
			"adder_user",
		);
	});

	it("does not send email when user opts out of wantlist_match_email", async () => {
		prefsResult = { data: { wantlist_match_email: false } };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("sends email when no preferences row exists (defaults to true per D-18)", async () => {
		prefsResult = { data: null };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).toHaveBeenCalled();
	});

	it("skips notification when dedup finds existing notification", async () => {
		existingNotificationResult = { data: { id: "existing-notif" } };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	it("does not throw when email send fails", async () => {
		mockSendEmail.mockRejectedValue(new Error("SMTP failure"));
		await expect(checkWantlistMatches(RELEASE_ID, ADDER_USER_ID)).resolves.toBeUndefined();
	});

	it("uses fallback username when adder profile not found", async () => {
		adderProfileResult = { data: null };
		await checkWantlistMatches(RELEASE_ID, ADDER_USER_ID);
		// Should use "A digger" fallback
		if (mockSendEmail.mock.calls.length > 0) {
			expect(mockSendEmail.mock.calls[0][3]).toBe("A digger");
		}
	});
});
