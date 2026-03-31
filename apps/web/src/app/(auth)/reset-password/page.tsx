import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
	title: "Set New Password | DigSwap",
	description: "Set a new password for your DigSwap account.",
};

/**
 * Reset password page.
 *
 * Accessed via the email reset link. Supabase handles the token exchange
 * through the OAuth callback route before this page loads, so the user
 * has a valid recovery session at this point.
 *
 * Per UI-SPEC Copywriting:
 * - Title: "Set New Password"
 */
export default function ResetPasswordPage() {
	return (
		<AuthCard title="Set New Password">
			<ResetPasswordForm />
		</AuthCard>
	);
}
