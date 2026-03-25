import { describe, it, expect } from "vitest";
import { signUpSchema } from "@/lib/validations/auth";

/**
 * Signup validation integration tests.
 *
 * Tests the signUpSchema validation layer (pure Zod, no Supabase needed).
 * Verifies input sanitization rules per SEC-01 and D-18.
 */
describe("Signup Validation (signUpSchema)", () => {
	describe("email validation", () => {
		it("rejects email without @ symbol", () => {
			const result = signUpSchema.safeParse({
				email: "not-an-email",
				password: "Test1234!",
				confirmPassword: "Test1234!",
			});
			expect(result.success).toBe(false);
		});

		it("rejects empty email", () => {
			const result = signUpSchema.safeParse({
				email: "",
				password: "Test1234!",
				confirmPassword: "Test1234!",
			});
			expect(result.success).toBe(false);
		});

		it("accepts valid email format", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Test1234!",
				confirmPassword: "Test1234!",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("password validation", () => {
		it("rejects password shorter than 8 characters", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Tes1!",
				confirmPassword: "Tes1!",
			});
			expect(result.success).toBe(false);
		});

		it("rejects password without uppercase letter", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "test1234!",
				confirmPassword: "test1234!",
			});
			expect(result.success).toBe(false);
		});

		it("rejects password without number", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Testtest!",
				confirmPassword: "Testtest!",
			});
			expect(result.success).toBe(false);
		});

		it("rejects password without special character", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Test12345",
				confirmPassword: "Test12345",
			});
			expect(result.success).toBe(false);
		});

		it("accepts valid strong password", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "StrongP@ss1",
				confirmPassword: "StrongP@ss1",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("password confirmation", () => {
		it("rejects mismatched passwords", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Test1234!",
				confirmPassword: "DifferentPass1!",
			});
			expect(result.success).toBe(false);
		});

		it("accepts matching passwords", () => {
			const result = signUpSchema.safeParse({
				email: "user@example.com",
				password: "Test1234!",
				confirmPassword: "Test1234!",
			});
			expect(result.success).toBe(true);
		});
	});

	describe("full valid input", () => {
		it("accepts complete valid signup data", () => {
			const result = signUpSchema.safeParse({
				email: "digger@vinyldig.com",
				password: "V1nylDig!",
				confirmPassword: "V1nylDig!",
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.email).toBe("digger@vinyldig.com");
				expect(result.data.password).toBe("V1nylDig!");
			}
		});
	});
});
