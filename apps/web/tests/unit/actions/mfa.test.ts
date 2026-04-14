import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";
const FACTOR_ID = "factor-3333-3333-3333-3333";
const CHALLENGE_ID = "chal-4444-4444-4444-4444";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let mockEnrollError: { message: string } | null = null;
let mockChallengeError: { message: string } | null = null;
let mockVerifyError: { message: string } | null = null;
let mockFactorsError: { message: string } | null = null;
let mockAalLevel = "aal2";
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/rate-limit", () => ({
	totpRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/supabase/server", () => ({
	createClient: vi.fn(async () => ({
		auth: {
			getUser: vi.fn(async () => ({
				data: { user: mockAuthUser },
				error: null,
			})),
			mfa: {
				enroll: vi.fn(async () => ({
					data: mockEnrollError
						? null
						: { id: FACTOR_ID, totp: { qr_code: "<svg/>", uri: "otpauth://totp/DigSwap" } },
					error: mockEnrollError,
				})),
				challenge: vi.fn(async () => ({
					data: mockChallengeError ? null : { id: CHALLENGE_ID },
					error: mockChallengeError,
				})),
				verify: vi.fn(async () => ({
					error: mockVerifyError,
				})),
				listFactors: vi.fn(async () => ({
					data: mockFactorsError
						? null
						: { totp: [{ id: FACTOR_ID, status: "verified" }] },
					error: mockFactorsError,
				})),
				unenroll: vi.fn(async () => ({ error: null })),
				getAuthenticatorAssuranceLevel: vi.fn(async () => ({
					data: { currentLevel: mockAalLevel },
					error: null,
				})),
			},
		},
	})),
}));

vi.mock("@/lib/supabase/admin", () => ({
	createAdminClient: vi.fn(() => ({
		auth: {
			admin: {
				updateUserById: vi.fn(async () => ({ error: null })),
			},
		},
	})),
}));

vi.mock("@/lib/backup-codes", () => ({
	generateBackupCodes: vi.fn((n: number) => Array.from({ length: n }, (_, i) => `CODE-${i}`)),
	storeBackupCodes: vi.fn(async () => {}),
	consumeBackupCode: vi.fn(async () => ({ success: true, remainingCodes: 9 })),
}));

vi.mock("@/lib/validations/auth", () => ({
	totpSchema: {
		safeParse: vi.fn((val: { code: string }) => {
			if (val.code && /^\d{6}$/.test(val.code)) return { success: true, data: val };
			return { success: false, error: { issues: [{ message: "Invalid code" }] } };
		}),
	},
	backupCodeSchema: {
		safeParse: vi.fn((val: { code: string }) => {
			if (val.code && val.code.length > 0) return { success: true, data: val };
			return { success: false, error: { issues: [{ message: "Required" }] } };
		}),
	},
}));

vi.mock("drizzle-orm", () => ({
	and: vi.fn((...args: unknown[]) => args),
	eq: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock("@/lib/db", () => {
	const chain: Record<string, unknown> = {};
	const methods = ["select", "from", "where", "limit"];
	for (const m of methods) {
		chain[m] = vi.fn().mockImplementation(() => chain);
	}
	chain.then = (resolve: (v: unknown) => void) => {
		const result = selectResults[queryCallCount] ?? [];
		queryCallCount++;
		return resolve(result);
	};
	chain.update = vi.fn().mockImplementation(() => ({
		set: vi.fn().mockImplementation(() => ({
			where: vi.fn().mockImplementation(() => ({
				then: (resolve: (v: unknown) => void) => {
					queryCallCount++;
					return resolve(undefined);
				},
			})),
		})),
	}));
	return { db: chain };
});

vi.mock("@/lib/db/schema/users", () => ({
	profiles: { id: "id", twoFactorEnabled: "two_factor_enabled", onboardingCompleted: "onboarding_completed", updatedAt: "updated_at" },
}));
vi.mock("@/lib/db/schema/sessions", () => ({
	backupCodes: { userId: "user_id", used: "used", usedAt: "used_at" },
}));

const { enrollTotp, verifyTotpEnrollment, challengeTotp, useBackupCode, disableTotp } =
	await import("@/actions/mfa");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	mockEnrollError = null;
	mockChallengeError = null;
	mockVerifyError = null;
	mockFactorsError = null;
	mockAalLevel = "aal2";
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("enrollTotp", () => {
	it("enrolls TOTP and returns QR code + backup codes", async () => {
		const result = await enrollTotp();
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.factorId).toBe(FACTOR_ID);
			expect(result.data.backupCodes).toHaveLength(10);
			expect(result.data.qrCode).toBeDefined();
		}
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await enrollTotp();
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("Not authenticated");
	});

	it("returns error on enroll failure", async () => {
		mockEnrollError = { message: "Enroll failed" };
		const result = await enrollTotp();
		expect(result.success).toBe(false);
	});
});

describe("verifyTotpEnrollment", () => {
	it("verifies TOTP code and enables 2FA", async () => {
		const result = await verifyTotpEnrollment(FACTOR_ID, "123456");
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await verifyTotpEnrollment(FACTOR_ID, "123456");
		expect(result.success).toBe(false);
	});

	it("rejects invalid code format", async () => {
		const result = await verifyTotpEnrollment(FACTOR_ID, "abc");
		expect(result.success).toBe(false);
	});

	it("returns error on challenge failure", async () => {
		mockChallengeError = { message: "Challenge failed" };
		const result = await verifyTotpEnrollment(FACTOR_ID, "123456");
		expect(result.success).toBe(false);
	});

	it("returns error on verify failure", async () => {
		mockVerifyError = { message: "Wrong code" };
		const result = await verifyTotpEnrollment(FACTOR_ID, "123456");
		expect(result.success).toBe(false);
	});
});

describe("challengeTotp", () => {
	it("verifies TOTP during login", async () => {
		selectResults = [[{ onboardingCompleted: true }]];
		const result = await challengeTotp("123456");
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.redirectTo).toBe("/feed");
	});

	it("redirects to onboarding if not completed", async () => {
		selectResults = [[{ onboardingCompleted: false }]];
		const result = await challengeTotp("123456");
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.redirectTo).toBe("/onboarding");
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await challengeTotp("123456");
		expect(result.success).toBe(false);
	});

	it("rejects invalid code", async () => {
		const result = await challengeTotp("abc");
		expect(result.success).toBe(false);
	});
});

describe("useBackupCode", () => {
	it("accepts valid backup code", async () => {
		selectResults = [[{ onboardingCompleted: true }]];
		const result = await useBackupCode("CODE-0");
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.remainingCodes).toBe(9);
		}
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await useBackupCode("CODE-0");
		expect(result.success).toBe(false);
	});

	it("rejects empty backup code", async () => {
		const result = await useBackupCode("");
		expect(result.success).toBe(false);
	});
});

describe("disableTotp", () => {
	it("disables 2FA when at AAL2", async () => {
		const result = await disableTotp();
		expect(result.success).toBe(true);
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await disableTotp();
		expect(result.success).toBe(false);
	});

	it("rejects when not at AAL2", async () => {
		mockAalLevel = "aal1";
		const result = await disableTotp();
		expect(result.success).toBe(false);
		if (!result.success) expect(result.error).toContain("authenticator");
	});
});
