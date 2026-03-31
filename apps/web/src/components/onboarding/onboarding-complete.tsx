"use client";

import { Loader2, PartyPopper } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { completeOnboarding } from "@/actions/onboarding";
import { Button } from "@/components/ui/button";

/**
 * Onboarding completion screen.
 *
 * Per UI-SPEC:
 * - Title: "You're In"
 * - Body: "Welcome to DigSwap. Start digging."
 * - CTA: "Go to Feed" (primary amber) -> calls completeOnboarding() then redirects to /
 */
export function OnboardingComplete() {
	const router = useRouter();
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleComplete() {
		setIsSubmitting(true);

		const result = await completeOnboarding();

		if (!result.success) {
			toast.error(result.error ?? "Failed to complete onboarding. Please try again.");
			setIsSubmitting(false);
			return;
		}

		router.push(result.redirectTo ?? "/feed");
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col items-center gap-4 py-4">
				<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
					<PartyPopper className="size-8 text-primary" />
				</div>
				<div className="text-center">
					<h3 className="font-heading text-lg font-semibold text-foreground">You&apos;re In</h3>
					<p className="mt-1 text-sm text-muted-foreground">Welcome to DigSwap. Start digging.</p>
				</div>
			</div>

			<Button
				className="h-11 w-full"
				disabled={isSubmitting}
				aria-busy={isSubmitting}
				onClick={handleComplete}
			>
				{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : "Go to Feed"}
			</Button>
		</div>
	);
}
