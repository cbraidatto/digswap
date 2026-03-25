import { z } from "zod";

/**
 * Password validation rules (per D-18, OWASP password guidelines):
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one number
 * - At least one special character
 */
const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters.")
	.regex(
		/[A-Z]/,
		"Password must be at least 8 characters with one uppercase letter, one number, and one special character.",
	)
	.regex(
		/[0-9]/,
		"Password must be at least 8 characters with one uppercase letter, one number, and one special character.",
	)
	.regex(
		/[^A-Za-z0-9]/,
		"Password must be at least 8 characters with one uppercase letter, one number, and one special character.",
	);

/**
 * Sign up form validation schema.
 * Requires email, password (with complexity rules), and matching confirmation.
 */
export const signUpSchema = z
	.object({
		email: z.string().email("Please enter a valid email address."),
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

/**
 * Sign in form validation schema.
 * Only requires valid email and non-empty password (no complexity rules on login).
 */
export const signInSchema = z.object({
	email: z.string().email("Please enter a valid email address."),
	password: z.string().min(1, "Password is required."),
});

/**
 * Forgot password form validation schema.
 * Only requires a valid email address.
 */
export const forgotPasswordSchema = z.object({
	email: z.string().email("Please enter a valid email address."),
});

/**
 * Reset password form validation schema.
 * Same password complexity rules as signup, with matching confirmation.
 */
export const resetPasswordSchema = z
	.object({
		password: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords do not match.",
		path: ["confirmPassword"],
	});

/**
 * TOTP 2FA code validation schema.
 * Exactly 6 numeric digits.
 */
export const totpSchema = z.object({
	code: z
		.string()
		.length(6, "Code must be exactly 6 digits.")
		.regex(/^\d{6}$/, "Code must contain only numbers."),
});

/**
 * Backup code validation schema.
 * Non-empty alphanumeric string.
 */
export const backupCodeSchema = z.object({
	code: z.string().min(1, "Backup code is required."),
});

/** TypeScript types inferred from schemas */
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type TotpInput = z.infer<typeof totpSchema>;
export type BackupCodeInput = z.infer<typeof backupCodeSchema>;
