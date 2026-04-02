import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { TotpSetup } from "@/components/auth/totp-setup";

export const metadata: Metadata = {
	title: "Set up 2FA — DigSwap",
	description: "Enable two-factor authentication to secure your account.",
};

/**
 * 2FA setup page during onboarding.
 *
 * Server Component rendering the TotpSetup component from Plan 06
 * inside an AuthCard. On completion or cancel, navigates back to
 * /onboarding (which will advance to step 3).
 */
export default function Onboarding2FAPage() {
	return (
		<div className="flex flex-col items-center gap-6">
			<AuthCard
				title="Set Up Two-Factor Authentication"
				subtitle="Scan this QR code with your authenticator app, then enter the 6-digit code to verify."
			>
				<TotpSetup />
			</AuthCard>

			<Link
				href="/onboarding?step=3"
				className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
			>
				Skip and continue onboarding
			</Link>
		</div>
	);
}
