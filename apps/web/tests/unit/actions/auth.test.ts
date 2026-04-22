import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
let mockAuthUser: { id: string; email?: string } | null = {
	id: "user-1",
	email: "test@example.com",
};

const mockSignUp = vi.fn();
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockResend = vi.fn();
const mockGetUser = vi.fn();
const mockMfaGetLevel = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			signUp: mockSignUp,
			signInWithPassword: mockSignIn,
			signOut: mockSignOut,
			resetPasswordForEmail: mockResetPasswordForEmail,
			updateUser: mockUpdateUser,
			resend: mockResend,
			getUser: mockGetUser,
			mfa: {
				getAuthenticatorAssuranceLevel: mockMfaGetLevel,
			},
		},
	})),
}));

// Admin client mock for session tracking in signIn
const mockAdminInsert = vi.fn().mockReturnValue({ error: null });
const mockAdminFrom = vi.fn().mockReturnValue({
	insert: mockAdminInsert,
});

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		from: mockAdminFrom,
	})),
}));

vi.mock("@/lib/auth/session-utils", () => ({
	extractSessionId: vi.fn(() => "mock-session-id"),
}));

vi.mock("@/lib/rate-limit", () => ({
	authRateLimit: null,
	resetRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/env", () => ({
	publicEnv: {
		NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
	},
}));

vi.mock("@/lib/db", () => ({
	db: {
		execute: vi.fn(async () => []),
	},
}));

const mockRedirect = vi.fn();
vi.mock("next/headers", () => ({
	headers: vi.fn(async () => ({
		get: vi.fn((key: string) => {
			if (key === "x-forwarded-for") return "127.0.0.1";
			if (key === "user-agent") return "test-browser";
			return null;
		}),
	})),
	cookies: vi.fn(async () => ({ getAll: () => [] })),
}));

vi.mock("next/navigation", () => ({
	redirect: (...args: unknown[]) => {
		mockRedirect(...args);
		// redirect() in Next.js throws to halt execution
		throw new Error("NEXT_REDIRECT");
	},
}));

// ---------------------------------------------------------------------------
// Import actions under test (after mocks)
// ---------------------------------------------------------------------------
const { signUp, signIn, signOut, forgotPassword, resetPassword, resendVerification } = await import(
	"@/actions/auth"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeFormData(entries: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [key, value] of Object.entries(entries)) {
		fd.set(key, value);
	}
	return fd;
}

const VALID_PASSWORD = "StrongP@ss1";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("auth actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockAuthUser = { id: "user-1", email: "test@example.com" };

		// Default mock return values
		mockSignUp.mockResolvedValue({ data: { user: mockAuthUser }, error: null });
		mockSignIn.mockResolvedValue({
			data: {
				user: mockAuthUser,
				session: { access_token: "mock-jwt-token" },
			},
			error: null,
		});
		mockSignOut.mockResolvedValue({ error: null });
		mockResetPasswordForEmail.mockResolvedValue({ error: null });
		mockUpdateUser.mockResolvedValue({ error: null });
		mockResend.mockResolvedValue({ error: null });
		mockGetUser.mockResolvedValue({ data: { user: mockAuthUser } });
		mockMfaGetLevel.mockResolvedValue({
			data: { currentLevel: "aal1", nextLevel: "aal1" },
			error: null,
		});
		mockAdminInsert.mockReturnValue({ error: null });
		mockRedirect.mockClear();
	});

	// -----------------------------------------------------------------------
	// signUp
	// -----------------------------------------------------------------------
	describe("signUp", () => {
		it("returns success with valid input", async () => {
			const fd = makeFormData({
				email: "new@example.com",
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await signUp(fd);

			expect(result.success).toBe(true);
			expect(result.email).toBe("new@example.com");
			expect(mockSignUp).toHaveBeenCalledWith({
				email: "new@example.com",
				password: VALID_PASSWORD,
				options: {
					emailRedirectTo: "http://localhost:3000/api/auth/callback",
				},
			});
		});

		it("rejects invalid email", async () => {
			const fd = makeFormData({
				email: "not-an-email",
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await signUp(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(mockSignUp).not.toHaveBeenCalled();
		});

		it("rejects password mismatch", async () => {
			const fd = makeFormData({
				email: "new@example.com",
				password: VALID_PASSWORD,
				confirmPassword: "DifferentP@ss1",
			});

			const result = await signUp(fd);

			expect(result.success).toBe(false);
			expect(result.error).toContain("Passwords do not match");
			expect(mockSignUp).not.toHaveBeenCalled();
		});

		it("rejects weak password (no uppercase)", async () => {
			const fd = makeFormData({
				email: "new@example.com",
				password: "weakpass1!",
				confirmPassword: "weakpass1!",
			});

			const result = await signUp(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(mockSignUp).not.toHaveBeenCalled();
		});

		it("rejects weak password (no special character)", async () => {
			const fd = makeFormData({
				email: "new@example.com",
				password: "StrongPass1",
				confirmPassword: "StrongPass1",
			});

			const result = await signUp(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(mockSignUp).not.toHaveBeenCalled();
		});

		it("returns generic error when Supabase signUp fails", async () => {
			mockSignUp.mockResolvedValue({
				data: { user: null },
				error: { message: "User already registered" },
			});

			const fd = makeFormData({
				email: "existing@example.com",
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await signUp(fd);

			expect(result.success).toBe(false);
			// OWASP: should NOT reveal that the user already exists
			expect(result.error).toBe("Invalid email or password. Please try again.");
		});
	});

	// -----------------------------------------------------------------------
	// signIn
	// -----------------------------------------------------------------------
	describe("signIn", () => {
		it("returns success with valid credentials", async () => {
			const fd = makeFormData({
				email: "test@example.com",
				password: VALID_PASSWORD,
			});

			const result = await signIn(fd);

			expect(result.success).toBe(true);
			expect(result.redirectTo).toBe("/onboarding");
			expect(mockSignIn).toHaveBeenCalledWith({
				email: "test@example.com",
				password: VALID_PASSWORD,
			});
		});

		it("rejects invalid email format", async () => {
			const fd = makeFormData({
				email: "bad-email",
				password: VALID_PASSWORD,
			});

			const result = await signIn(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(mockSignIn).not.toHaveBeenCalled();
		});

		it("rejects empty password", async () => {
			const fd = makeFormData({
				email: "test@example.com",
				password: "",
			});

			const result = await signIn(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
			expect(mockSignIn).not.toHaveBeenCalled();
		});

		it("returns generic error when Supabase signIn fails", async () => {
			mockSignIn.mockResolvedValue({
				data: { user: null, session: null },
				error: { message: "Invalid login credentials" },
			});

			const fd = makeFormData({
				email: "test@example.com",
				password: "WrongP@ss1",
			});

			const result = await signIn(fd);

			expect(result.success).toBe(false);
			expect(result.error).toBe("Invalid email or password. Please try again.");
		});

		it("records session in user_sessions on successful login", async () => {
			const fd = makeFormData({
				email: "test@example.com",
				password: VALID_PASSWORD,
			});

			await signIn(fd);

			expect(mockAdminFrom).toHaveBeenCalledWith("user_sessions");
			expect(mockAdminInsert).toHaveBeenCalledWith(
				expect.objectContaining({
					user_id: "user-1",
					session_id: "mock-session-id",
					device_info: "test-browser",
					ip_address: "127.0.0.1",
				}),
			);
		});

		it("returns mfaRequired when MFA is needed", async () => {
			mockMfaGetLevel.mockResolvedValue({
				data: { currentLevel: "aal1", nextLevel: "aal2" },
				error: null,
			});

			const fd = makeFormData({
				email: "test@example.com",
				password: VALID_PASSWORD,
			});

			const result = await signIn(fd);

			expect(result.success).toBe(true);
			expect(result.mfaRequired).toBe(true);
		});
	});

	// -----------------------------------------------------------------------
	// forgotPassword
	// -----------------------------------------------------------------------
	describe("forgotPassword", () => {
		it("returns success with valid email", async () => {
			const fd = makeFormData({ email: "test@example.com" });

			const result = await forgotPassword(fd);

			expect(result.success).toBe(true);
			expect(result.message).toContain("reset link has been sent");
			expect(mockResetPasswordForEmail).toHaveBeenCalledWith("test@example.com", {
				redirectTo: "http://localhost:3000/api/auth/callback?next=/reset-password",
			});
		});

		it("rejects invalid email format", async () => {
			const fd = makeFormData({ email: "not-valid" });

			const result = await forgotPassword(fd);

			expect(result.success).toBe(false);
			expect(result.message).toContain("valid email");
			expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
		});

		it("always returns success even when Supabase errors (OWASP)", async () => {
			mockResetPasswordForEmail.mockResolvedValue({
				error: { message: "User not found" },
			});

			const fd = makeFormData({ email: "nonexistent@example.com" });

			const result = await forgotPassword(fd);

			// OWASP: must return success to prevent email enumeration
			expect(result.success).toBe(true);
			expect(result.message).toContain("reset link has been sent");
		});
	});

	// -----------------------------------------------------------------------
	// resetPassword
	// -----------------------------------------------------------------------
	describe("resetPassword", () => {
		it("returns success with valid password", async () => {
			const fd = makeFormData({
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await resetPassword(fd);

			expect(result.success).toBe(true);
			expect(result.message).toContain("Password updated");
			expect(mockUpdateUser).toHaveBeenCalledWith({
				password: VALID_PASSWORD,
			});
		});

		it("rejects password mismatch", async () => {
			const fd = makeFormData({
				password: VALID_PASSWORD,
				confirmPassword: "DifferentP@ss1",
			});

			const result = await resetPassword(fd);

			expect(result.success).toBe(false);
			expect(mockUpdateUser).not.toHaveBeenCalled();
		});

		it("rejects weak password", async () => {
			const fd = makeFormData({
				password: "weak",
				confirmPassword: "weak",
			});

			const result = await resetPassword(fd);

			expect(result.success).toBe(false);
			expect(mockUpdateUser).not.toHaveBeenCalled();
		});

		it("handles expired recovery link", async () => {
			mockUpdateUser.mockResolvedValue({
				error: { message: "Token has expired", status: 403 },
			});

			const fd = makeFormData({
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await resetPassword(fd);

			expect(result.success).toBe(false);
			expect(result.message).toContain("expired");
		});

		it("handles generic Supabase error", async () => {
			mockUpdateUser.mockResolvedValue({
				error: { message: "Internal server error", status: 500 },
			});

			const fd = makeFormData({
				password: VALID_PASSWORD,
				confirmPassword: VALID_PASSWORD,
			});

			const result = await resetPassword(fd);

			expect(result.success).toBe(false);
			expect(result.message).toContain("Something went wrong");
		});
	});

	// -----------------------------------------------------------------------
	// signOut
	// -----------------------------------------------------------------------
	describe("signOut", () => {
		it("calls signOut and redirects to /signin", async () => {
			await expect(signOut()).rejects.toThrow("NEXT_REDIRECT");

			expect(mockSignOut).toHaveBeenCalled();
			expect(mockRedirect).toHaveBeenCalledWith("/signin");
		});
	});

	// -----------------------------------------------------------------------
	// resendVerification
	// -----------------------------------------------------------------------
	describe("resendVerification", () => {
		it("calls resend with correct email and type", async () => {
			const result = await resendVerification("test@example.com");

			expect(result.success).toBe(true);
			expect(mockResend).toHaveBeenCalledWith({
				type: "signup",
				email: "test@example.com",
			});
		});

		it("returns error for empty email", async () => {
			const result = await resendVerification("");

			expect(result.success).toBe(false);
			expect(result.error).toContain("Email is required");
			expect(mockResend).not.toHaveBeenCalled();
		});

		it("always returns success even when Supabase errors (anti-enumeration)", async () => {
			mockResend.mockResolvedValue({
				error: { message: "User not found" },
			});

			const result = await resendVerification("nonexistent@example.com");

			// Must return success to prevent email enumeration
			expect(result.success).toBe(true);
		});
	});
});
