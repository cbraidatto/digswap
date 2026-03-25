import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
	title: "Reset Your Password | VinylDig",
	description: "Request a password reset link for your VinylDig account.",
};

/**
 * Forgot password page.
 *
 * Per UI-SPEC Copywriting:
 * - Title: "Reset Your Password"
 * - Body: "Enter your email and we'll send you a reset link."
 */
export default function ForgotPasswordPage() {
	return (
		<AuthCard
			title="Reset Your Password"
			subtitle="Enter your email and we'll send you a reset link."
		>
			<ForgotPasswordForm />
		</AuthCard>
	);
}
