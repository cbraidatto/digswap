import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const MOCK_USER = {
	id: "user-11111-11111-11111-11111",
	email: "digger@example.com",
	app_metadata: {},
	user_metadata: {},
	aud: "authenticated",
	created_at: "2024-01-01T00:00:00Z",
};

let mockGetUserResult: { data: { user: typeof MOCK_USER | null } } = {
	data: { user: MOCK_USER },
};

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => mockGetUserResult),
		},
	})),
}));

const { requireUser } = await import("@/lib/auth/require-user");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockGetUserResult = { data: { user: MOCK_USER } };
	vi.clearAllMocks();
});

describe("requireUser", () => {
	it("returns the authenticated user", async () => {
		const user = await requireUser();
		expect(user).toEqual(MOCK_USER);
		expect(user.id).toBe(MOCK_USER.id);
	});

	it("throws 'Not authenticated' when no user in session", async () => {
		mockGetUserResult = { data: { user: null } };
		await expect(requireUser()).rejects.toThrow("Not authenticated");
	});

	it("returns user with email when present", async () => {
		const user = await requireUser();
		expect(user.email).toBe("digger@example.com");
	});

	it("calls createClient and getUser each invocation", async () => {
		const { createClient } = await import("@/lib/supabase/server");
		await requireUser();
		expect(createClient).toHaveBeenCalled();
	});
});
