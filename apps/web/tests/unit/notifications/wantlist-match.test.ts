import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock sendWantlistMatchEmail
const mockSendEmail = vi.fn();
vi.mock("@/lib/notifications/email", () => ({
	sendWantlistMatchEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

// Mock admin client
const mockFrom = vi.fn();
const mockAuthAdmin = {
	getUserById: vi.fn(),
};
const mockAdminClient = {
	from: mockFrom,
	auth: { admin: mockAuthAdmin },
};

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: () => mockAdminClient,
}));

import { checkWantlistMatches } from "@/lib/notifications/match";

// Helper to build chainable Supabase query mock
function createQueryChain(result: { data?: unknown; error?: unknown }) {
	const chain: Record<string, unknown> = {};
	const methods = [
		"select",
		"eq",
		"neq",
		"single",
		"maybeSingle",
		"insert",
	];
	for (const method of methods) {
		chain[method] = vi.fn().mockReturnValue(chain);
	}
	// The last call in the chain resolves
	chain.then = (resolve: (v: unknown) => void) => resolve(result);
	return chain;
}

describe("checkWantlistMatches", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSendEmail.mockResolvedValue(undefined);
	});

	test("creates notifications when wantlist matches are found", async () => {
		// Wantlist matches
		const matchChain = createQueryChain({
			data: [{ user_id: "wanter-1" }],
		});
		// Release info
		const releaseChain = createQueryChain({
			data: { title: "Kind of Blue", artist: "Miles Davis", discogs_id: 123 },
		});
		// Adder profile
		const adderChain = createQueryChain({
			data: { username: "cooldigger" },
		});
		// Insert notification
		const insertChain = createQueryChain({ data: null });
		// Notification prefs (email enabled by default)
		const prefsChain = createQueryChain({
			data: { wantlist_match_email: true },
		});
		// Get user email
		mockAuthAdmin.getUserById.mockResolvedValue({
			data: { user: { email: "wanter@example.com" } },
		});

		let fromCallCount = 0;
		mockFrom.mockImplementation((table: string) => {
			fromCallCount++;
			if (table === "wantlist_items") return matchChain;
			if (table === "releases") return releaseChain;
			if (table === "profiles") return adderChain;
			if (table === "notifications") return insertChain;
			if (table === "notification_preferences") return prefsChain;
			return createQueryChain({ data: null });
		});

		await checkWantlistMatches("release-1", "adder-user");

		// Should have called from("notifications") to insert
		expect(mockFrom).toHaveBeenCalledWith("notifications");
		// Should have sent email
		expect(mockSendEmail).toHaveBeenCalledWith(
			"wanter@example.com",
			"Kind of Blue",
			"Miles Davis",
			"cooldigger",
		);
	});

	test("returns early when no wantlist matches exist", async () => {
		const emptyChain = createQueryChain({ data: [] });
		mockFrom.mockReturnValue(emptyChain);

		await checkWantlistMatches("release-1", "adder-user");

		// Should not have tried to get release info (only one .from call for wantlist_items)
		expect(mockFrom).toHaveBeenCalledTimes(1);
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	test("skips email when wantlist_match_email is false", async () => {
		const matchChain = createQueryChain({
			data: [{ user_id: "wanter-1" }],
		});
		const releaseChain = createQueryChain({
			data: { title: "Kind of Blue", artist: "Miles Davis", discogs_id: 123 },
		});
		const adderChain = createQueryChain({
			data: { username: "cooldigger" },
		});
		const insertChain = createQueryChain({ data: null });
		// Email DISABLED
		const prefsChain = createQueryChain({
			data: { wantlist_match_email: false },
		});

		mockFrom.mockImplementation((table: string) => {
			if (table === "wantlist_items") return matchChain;
			if (table === "releases") return releaseChain;
			if (table === "profiles") return adderChain;
			if (table === "notifications") return insertChain;
			if (table === "notification_preferences") return prefsChain;
			return createQueryChain({ data: null });
		});

		await checkWantlistMatches("release-1", "adder-user");

		// Notification should be inserted but no email sent
		expect(mockFrom).toHaveBeenCalledWith("notifications");
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	test("skips when release has no discogs_id", async () => {
		const matchChain = createQueryChain({
			data: [{ user_id: "wanter-1" }],
		});
		// Release with no discogs_id
		const releaseChain = createQueryChain({
			data: { title: "Custom Record", artist: "Local Band", discogs_id: null },
		});

		mockFrom.mockImplementation((table: string) => {
			if (table === "wantlist_items") return matchChain;
			if (table === "releases") return releaseChain;
			return createQueryChain({ data: null });
		});

		await checkWantlistMatches("release-1", "adder-user");

		// Should not have inserted notifications or sent email
		expect(mockFrom).not.toHaveBeenCalledWith("notifications");
		expect(mockSendEmail).not.toHaveBeenCalled();
	});

	test("email failure does not throw from checkWantlistMatches", async () => {
		const matchChain = createQueryChain({
			data: [{ user_id: "wanter-1" }],
		});
		const releaseChain = createQueryChain({
			data: { title: "Kind of Blue", artist: "Miles Davis", discogs_id: 123 },
		});
		const adderChain = createQueryChain({
			data: { username: "cooldigger" },
		});
		const insertChain = createQueryChain({ data: null });
		const prefsChain = createQueryChain({
			data: { wantlist_match_email: true },
		});

		mockAuthAdmin.getUserById.mockResolvedValue({
			data: { user: { email: "wanter@example.com" } },
		});

		// Email will throw
		mockSendEmail.mockRejectedValue(new Error("Resend API down"));

		mockFrom.mockImplementation((table: string) => {
			if (table === "wantlist_items") return matchChain;
			if (table === "releases") return releaseChain;
			if (table === "profiles") return adderChain;
			if (table === "notifications") return insertChain;
			if (table === "notification_preferences") return prefsChain;
			return createQueryChain({ data: null });
		});

		// Should not throw
		await expect(
			checkWantlistMatches("release-1", "adder-user"),
		).resolves.toBeUndefined();
	});
});
