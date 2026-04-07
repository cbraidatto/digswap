import { describe, expect, it } from "vitest";
import {
	backupCodeSchema,
	forgotPasswordSchema,
	resetPasswordSchema,
	signInSchema,
	signUpSchema,
	totpSchema,
} from "@/lib/validations/auth";

describe("signUpSchema", () => {
	it("rejects empty email", () => {
		const result = signUpSchema.safeParse({
			email: "",
			password: "Test1234!",
			confirmPassword: "Test1234!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects invalid email format", () => {
		const result = signUpSchema.safeParse({
			email: "not-an-email",
			password: "Test1234!",
			confirmPassword: "Test1234!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects password shorter than 8 chars", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "Te1!",
			confirmPassword: "Te1!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects password without uppercase letter", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "test1234!",
			confirmPassword: "test1234!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects password without number", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "Testtest!",
			confirmPassword: "Testtest!",
		});
		expect(result.success).toBe(false);
	});

	it("rejects password without special character", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "Test1234a",
			confirmPassword: "Test1234a",
		});
		expect(result.success).toBe(false);
	});

	it("rejects mismatched passwords", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "Test1234!",
			confirmPassword: "Test1234@",
		});
		expect(result.success).toBe(false);
	});

	it("accepts valid email + strong password + matching confirm", () => {
		const result = signUpSchema.safeParse({
			email: "test@example.com",
			password: "Test1234!",
			confirmPassword: "Test1234!",
		});
		expect(result.success).toBe(true);
	});
});

describe("signInSchema", () => {
	it("rejects empty password", () => {
		const result = signInSchema.safeParse({
			email: "test@example.com",
			password: "",
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty email", () => {
		const result = signInSchema.safeParse({
			email: "",
			password: "any-password",
		});
		expect(result.success).toBe(false);
	});

	it("accepts valid email and non-empty password", () => {
		const result = signInSchema.safeParse({
			email: "test@example.com",
			password: "anypassword",
		});
		expect(result.success).toBe(true);
	});
});

describe("totpSchema", () => {
	it("rejects non-6-digit input", () => {
		const result = totpSchema.safeParse({ code: "12345" });
		expect(result.success).toBe(false);
	});

	it("rejects non-numeric input", () => {
		const result = totpSchema.safeParse({ code: "abcdef" });
		expect(result.success).toBe(false);
	});

	it("rejects 7-digit input", () => {
		const result = totpSchema.safeParse({ code: "1234567" });
		expect(result.success).toBe(false);
	});

	it("accepts exactly 6 numeric digits", () => {
		const result = totpSchema.safeParse({ code: "123456" });
		expect(result.success).toBe(true);
	});
});

describe("forgotPasswordSchema", () => {
	it("rejects invalid email", () => {
		const result = forgotPasswordSchema.safeParse({
			email: "not-valid",
		});
		expect(result.success).toBe(false);
	});

	it("rejects empty email", () => {
		const result = forgotPasswordSchema.safeParse({
			email: "",
		});
		expect(result.success).toBe(false);
	});

	it("accepts valid email", () => {
		const result = forgotPasswordSchema.safeParse({
			email: "test@example.com",
		});
		expect(result.success).toBe(true);
	});
});

describe("resetPasswordSchema", () => {
	it("enforces same password rules as signUpSchema", () => {
		// Too short
		expect(
			resetPasswordSchema.safeParse({
				password: "Te1!",
				confirmPassword: "Te1!",
			}).success,
		).toBe(false);

		// No uppercase
		expect(
			resetPasswordSchema.safeParse({
				password: "test1234!",
				confirmPassword: "test1234!",
			}).success,
		).toBe(false);

		// No number
		expect(
			resetPasswordSchema.safeParse({
				password: "Testtest!",
				confirmPassword: "Testtest!",
			}).success,
		).toBe(false);

		// No special char
		expect(
			resetPasswordSchema.safeParse({
				password: "Test1234a",
				confirmPassword: "Test1234a",
			}).success,
		).toBe(false);

		// Mismatched
		expect(
			resetPasswordSchema.safeParse({
				password: "Test1234!",
				confirmPassword: "Test1234@",
			}).success,
		).toBe(false);

		// Valid
		expect(
			resetPasswordSchema.safeParse({
				password: "Test1234!",
				confirmPassword: "Test1234!",
			}).success,
		).toBe(true);
	});
});

describe("backupCodeSchema", () => {
	it("rejects empty code", () => {
		const result = backupCodeSchema.safeParse({ code: "" });
		expect(result.success).toBe(false);
	});

	it("accepts non-empty alphanumeric code", () => {
		const result = backupCodeSchema.safeParse({ code: "ABC123" });
		expect(result.success).toBe(true);
	});
});
