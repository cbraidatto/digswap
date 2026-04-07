import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { TotpChallenge } from "@/components/auth/totp-challenge";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
	title: "Two-Factor Authentication | DigSwap",
	description: "Enter your verification code to complete sign in.",
};

/**
 * 2FA challenge page at /signin/2fa.
 *
 * Server Component that checks user is at AAL1 (logged in but needs 2FA).
 * If not authenticated or already at AAL2, redirects appropriately.
 *
 * Per UI-SPEC: AuthCard with title "Enter Verification Code", max-width 380px.
 */
export default async function TwoFactorPage() {
	const supabase = await createClient();

	// Check authentication state
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		// Not authenticated at all -- redirect to sign in
		redirect("/signin");
	}

	// Check MFA assurance level
	const { data: aalData, error: aalError } =
		await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

	if (aalError) {
		// Error checking MFA level -- redirect to sign in
		redirect("/signin");
	}

	if (aalData.currentLevel === "aal2") {
		// Already fully authenticated -- redirect to home
		redirect("/");
	}

	if (aalData.nextLevel !== "aal2") {
		// No MFA required -- redirect to home
		redirect("/");
	}

	return (
		<div className="w-full max-w-[380px]">
			<AuthCard title="Enter Verification Code">
				<TotpChallenge />
			</AuthCard>
		</div>
	);
}
