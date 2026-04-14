import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string; email?: string } | null = { id: USER_ID };
let mockDeleteError: { message: string } | null = null;

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: null,
			})),
			signOut: vi.fn(async () => ({})),
		},
	})),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		auth: {
			admin: {
				deleteUser: vi.fn(async () => ({
					error: mockDeleteError,
				})),
			},
		},
	})),
}));

vi.mock("next/headers", () => ({
	headers: vi.fn(async () => ({
		get: vi.fn((key: string) => {
			if (key === "x-forwarded-for") return "127.0.0.1";
			return null;
		}),
	})),
}));

const { deleteAccountAction } = await import("@/actions/account");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	mockAuthUser = { id: USER_ID, email: "test@example.com" };
	mockDeleteError = null;
	vi.clearAllMocks();
});

describe("deleteAccountAction", () => {
	function makeFormData(confirmation: string): FormData {
		const fd = new FormData();
		fd.set("confirmation", confirmation);
		return fd;
	}

	it("deletes account with correct confirmation", async () => {
		const result = await deleteAccountAction(makeFormData("DELETE MY ACCOUNT"));
		expect(result.success).toBe(true);
	});

	it("rejects wrong confirmation text", async () => {
		const result = await deleteAccountAction(makeFormData("delete my account"));
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await deleteAccountAction(makeFormData("DELETE MY ACCOUNT"));
		expect(result.success).toBe(false);
		expect(result.error).toContain("Not authenticated");
	});

	it("returns error when admin delete fails", async () => {
		mockDeleteError = { message: "Admin error" };
		const result = await deleteAccountAction(makeFormData("DELETE MY ACCOUNT"));
		expect(result.success).toBe(false);
		expect(result.error).toContain("Failed to delete");
	});

	it("rejects empty confirmation", async () => {
		const result = await deleteAccountAction(makeFormData(""));
		expect(result.success).toBe(false);
	});
});
