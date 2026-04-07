"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { DiscogsConnect } from "@/components/onboarding/discogs-connect";
import { OnboardingComplete } from "@/components/onboarding/onboarding-complete";
import { ProfileSetup } from "@/components/onboarding/profile-setup";
import { SecuritySetup } from "@/components/onboarding/security-setup";
import { StepIndicator } from "@/components/onboarding/step-indicator";

/**
 * Main onboarding page -- client component for step tracking.
 *
 * Manages current step state (1-4, where 4 is completion).
 * Renders StepIndicator above AuthCard (wide variant, 520px).
 *
 * Step flow:
 * 1. Profile setup (display name + avatar)
 * 2. Security setup (2FA suggestion, skippable)
 * 3. Discogs connection (non-skippable — must connect to proceed)
 * 4. Completion screen
 *
 * Supports ?step=N query param for returning from /onboarding/2fa.
 */

/** Step titles per UI-SPEC */
const STEP_TITLES: Record<number, { title: string; subtitle?: string }> = {
	1: {
		title: "Set Up Your Profile",
		subtitle: "Choose a display name and avatar. This is how other diggers will find you.",
	},
	2: {
		title: "Secure Your Account",
	},
	3: {
		title: "Connect Discogs",
	},
	4: {
		title: "You're In",
	},
};

export default function OnboardingPage() {
	const searchParams = useSearchParams();
	const [currentStep, setCurrentStep] = useState(1);

	// Handle ?step=N query param (for returning from /onboarding/2fa)
	useEffect(() => {
		const stepParam = searchParams.get("step");
		if (stepParam) {
			const parsed = Number.parseInt(stepParam, 10);
			if (parsed >= 1 && parsed <= 4) {
				setCurrentStep(parsed);
			}
		}
	}, [searchParams]);

	const stepInfo = STEP_TITLES[currentStep] ?? STEP_TITLES[1];

	function renderStep() {
		switch (currentStep) {
			case 1:
				return <ProfileSetup onComplete={() => setCurrentStep(2)} />;
			case 2:
				return <SecuritySetup onSkip={() => setCurrentStep(3)} />;
			case 3:
				return <DiscogsConnect onSkip={() => setCurrentStep(4)} />;
			case 4:
				return <OnboardingComplete />;
			default:
				return <ProfileSetup onComplete={() => setCurrentStep(2)} />;
		}
	}

	return (
		<div className="flex flex-col items-center gap-6">
			{/* Step indicator shown for steps 1-3, hidden on completion */}
			{currentStep <= 3 && <StepIndicator currentStep={currentStep} totalSteps={3} />}

			<AuthCard title={stepInfo.title} subtitle={stepInfo.subtitle} wide>
				{renderStep()}
			</AuthCard>
		</div>
	);
}
