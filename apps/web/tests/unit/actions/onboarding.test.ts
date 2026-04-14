import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
const USER_ID = "user-1111-1111-1111-1111";

let mockAuthUser: { id: string } | null = { id: USER_ID };
let selectResults: unknown[][] = [];
let queryCallCount = 0;

vi.mock("@/lib/auth/require-user", () => ({
	requireUser: vi.fn(async () => {
		if (!mockAuthUser) throw new Error("Not authenticated");
		return mockAuthUser;
	}),
}));

vi.mock("@/lib/rate-limit", () => ({
	apiRateLimit: null,
	safeLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/validations/onboarding", () => ({
	onboardingProfileSchema: {
		safeParse: vi.fn((val: Record<string, unknown>) => {
			const name = val.display_name as string;
			if (!name || name.length < 3 || name.length > 50) {
				return { success: false, error: { issues: [{ message: "Display name must be 3-50 characters" }] } };
			}
			return { success: true, data: { display_name: name, avatar_url: val.avatar_url ?? null } };
		}),
	},
	skipToStepSchema: {
		safeParse: vi.fn((val: { step: number }) => {
			if (typeof val.step !== "number" || val.step < 1 || val.step > 5) {
				return { success: false, error: { issues: [{ message: "Invalid step number" }] } };
			}
			return { success: true, data: { step: val.step } };
		}),
	},
}));

vi.mock("drizzle-orm", () => ({
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
	profiles: { id: "id", displayName: "display_name", avatarUrl: "avatar_url", onboardingCompleted: "onboarding_completed", updatedAt: "updated_at" },
}));

const { updateProfile, completeOnboarding, skipToStep } = await import("@/actions/onboarding");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
beforeEach(() => {
	mockAuthUser = { id: USER_ID };
	selectResults = [];
	queryCallCount = 0;
	vi.clearAllMocks();
});

describe("updateProfile", () => {
	function makeFormData(displayName: string, avatarUrl?: string): FormData {
		const fd = new FormData();
		fd.set("display_name", displayName);
		if (avatarUrl) fd.set("avatar_url", avatarUrl);
		return fd;
	}

	it("updates profile with valid display name", async () => {
		const result = await updateProfile(makeFormData("CoolDigger"));
		expect(result.success).toBe(true);
	});

	it("rejects too short display name", async () => {
		const result = await updateProfile(makeFormData("ab"));
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await updateProfile(makeFormData("CoolDigger"));
		expect(result.success).toBe(false);
	});

	it("accepts profile with avatar URL", async () => {
		const result = await updateProfile(makeFormData("CoolDigger", "https://example.com/avatar.jpg"));
		expect(result.success).toBe(true);
	});
});

describe("completeOnboarding", () => {
	it("marks onboarding as complete", async () => {
		const result = await completeOnboarding();
		expect(result.success).toBe(true);
		expect(result.redirectTo).toBe("/feed");
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await completeOnboarding();
		expect(result.success).toBe(false);
	});
});

describe("skipToStep", () => {
	it("returns next step for valid step number", async () => {
		const result = await skipToStep(2);
		expect(result.success).toBe(true);
		expect(result.nextStep).toBe(2);
	});

	it("rejects invalid step number", async () => {
		const result = await skipToStep(99);
		expect(result.success).toBe(false);
		expect(result.error).toBeDefined();
	});

	it("rejects unauthenticated user", async () => {
		mockAuthUser = null;
		const result = await skipToStep(2);
		expect(result.success).toBe(false);
	});
});
