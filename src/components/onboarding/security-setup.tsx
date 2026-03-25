"use client";

import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";

import { Button } from "@/components/ui/button";

interface SecuritySetupProps {
	onSkip: () => void;
}

/**
 * Onboarding Step 2: 2FA suggestion (not mandatory, per D-08).
 *
 * Per UI-SPEC:
 * - Title: "Secure Your Account"
 * - Body: "Two-factor authentication adds an extra layer of security. We recommend enabling it."
 * - Primary CTA: "Enable 2FA" -> navigates to /onboarding/2fa
 * - Secondary CTA: "Skip for Now" -> advances to step 3
 */
export function SecuritySetup({ onSkip }: SecuritySetupProps) {
	const router = useRouter();

	return (
		<div className="space-y-6">
			<div className="flex flex-col items-center gap-4">
				<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
					<Shield className="size-8 text-primary" />
				</div>
				<p className="text-center text-sm text-muted-foreground">
					Two-factor authentication adds an extra layer of security. We
					recommend enabling it.
				</p>
			</div>

			<div className="space-y-3">
				<Button
					className="h-11 w-full"
					onClick={() => router.push("/onboarding/2fa")}
				>
					Enable 2FA
				</Button>

				<Button
					variant="ghost"
					className="h-11 w-full"
					onClick={onSkip}
				>
					Skip for Now
				</Button>
			</div>
		</div>
	);
}
