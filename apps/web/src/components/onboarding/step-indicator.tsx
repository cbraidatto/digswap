"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepIndicatorProps {
	currentStep: number;
	totalSteps?: number;
}

/**
 * Step progress indicator for the onboarding wizard.
 * Renders dots/circles for each step:
 * - Current step: amber accent fill
 * - Completed steps: amber outline with checkmark
 * - Future steps: muted border, no fill
 *
 * Per UI-SPEC: Step indicator dots shown immediately (no skeleton).
 */
export function StepIndicator({ currentStep, totalSteps = 3 }: StepIndicatorProps) {
	return (
		<div
			className="flex items-center justify-center gap-3"
			role="navigation"
			aria-label="Onboarding progress"
		>
			{Array.from({ length: totalSteps }, (_, i) => {
				const step = i + 1;
				const isCompleted = step < currentStep;
				const isCurrent = step === currentStep;

				return (
					<div key={step} className="flex items-center gap-3">
						<div
							className={cn(
								"flex size-8 items-center justify-center rounded-full border-2 transition-colors",
								isCompleted && "border-primary bg-transparent text-primary",
								isCurrent && "border-primary bg-primary text-primary-foreground",
								!isCompleted && !isCurrent && "border-muted-foreground/30 text-muted-foreground/30",
							)}
							aria-current={isCurrent ? "step" : undefined}
							aria-label={`Step ${step}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
						>
							{isCompleted ? (
								<Check className="size-4" />
							) : (
								<span className="text-sm font-medium">{step}</span>
							)}
						</div>
						{step < totalSteps && (
							<div
								className={cn(
									"h-0.5 w-8 transition-colors",
									step < currentStep ? "bg-primary" : "bg-muted-foreground/30",
								)}
							/>
						)}
					</div>
				);
			})}
		</div>
	);
}
