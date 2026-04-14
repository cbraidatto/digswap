import { describe, expect, it } from "vitest";
import { onboardingProfileSchema, skipToStepSchema } from "@/lib/validations/onboarding";

describe("onboardingProfileSchema", () => {
	it("accepts valid display_name", () => {
		expect(onboardingProfileSchema.safeParse({ display_name: "vinyl-digger" }).success).toBe(true);
	});

	it("rejects display_name under 3 chars", () => {
		expect(onboardingProfileSchema.safeParse({ display_name: "ab" }).success).toBe(false);
	});

	it("rejects display_name over 50 chars", () => {
		expect(onboardingProfileSchema.safeParse({ display_name: "a".repeat(51) }).success).toBe(false);
	});

	it("accepts alphanumeric with hyphens and underscores", () => {
		expect(onboardingProfileSchema.safeParse({ display_name: "user_name-123" }).success).toBe(true);
	});

	it("rejects special characters", () => {
		expect(onboardingProfileSchema.safeParse({ display_name: "user@name!" }).success).toBe(false);
	});

	it("accepts optional Supabase avatar_url", () => {
		const r = onboardingProfileSchema.safeParse({
			display_name: "user123",
			avatar_url: "https://test.supabase.co/storage/v1/object/public/avatars/pic.jpg",
		});
		expect(r.success).toBe(true);
	});

	it("accepts empty avatar_url", () => {
		const r = onboardingProfileSchema.safeParse({
			display_name: "user123",
			avatar_url: "",
		});
		expect(r.success).toBe(true);
	});

	it("accepts null avatar_url", () => {
		const r = onboardingProfileSchema.safeParse({
			display_name: "user123",
			avatar_url: null,
		});
		expect(r.success).toBe(true);
	});
});

describe("skipToStepSchema", () => {
	it("accepts step 1", () => {
		expect(skipToStepSchema.safeParse({ step: 1 }).success).toBe(true);
	});

	it("accepts step 10", () => {
		expect(skipToStepSchema.safeParse({ step: 10 }).success).toBe(true);
	});

	it("rejects step 0", () => {
		expect(skipToStepSchema.safeParse({ step: 0 }).success).toBe(false);
	});

	it("rejects step above 10", () => {
		expect(skipToStepSchema.safeParse({ step: 11 }).success).toBe(false);
	});

	it("rejects non-integer", () => {
		expect(skipToStepSchema.safeParse({ step: 1.5 }).success).toBe(false);
	});
});
