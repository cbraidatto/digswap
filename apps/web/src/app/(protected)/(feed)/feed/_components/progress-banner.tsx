import Link from "next/link";
import { Progress } from "@/components/ui/progress";

interface ProgressBannerProps {
	discogsConnected: boolean;
	followingCount: number;
}

export function ProgressBanner({
	discogsConnected,
	followingCount,
}: ProgressBannerProps) {
	const step1Complete = discogsConnected;
	const step2Complete = followingCount >= 3;
	// Step 3 always locked in Phase 5
	const completedSteps =
		(step1Complete ? 1 : 0) + (step2Complete ? 1 : 0);

	return (
		<div className="bg-surface-container-low rounded-lg p-6 mb-8 border border-outline-variant/10">
			{/* Header row */}
			<div className="flex justify-between items-center mb-3">
				<span className="font-mono text-xs text-on-surface-variant uppercase tracking-[0.2em]">
					Onboarding_Progress
				</span>
				<span className="font-mono text-xs text-primary">
					{completedSteps} / 3 COMPLETE
				</span>
			</div>

			{/* Progress bar */}
			<Progress value={(completedSteps / 3) * 100} className="[&_[data-slot=progress-track]]:h-1 [&_[data-slot=progress-track]]:bg-surface-container-high [&_[data-slot=progress-indicator]]:bg-primary" />

			{/* Steps row */}
			<div className="flex flex-wrap gap-4 mt-4">
				{/* Step 1: Connect Discogs */}
				<div className="flex items-center gap-2">
					{step1Complete ? (
						<>
							<span className="material-symbols-outlined text-primary text-base">
								check_circle
							</span>
							<span className="font-mono text-xs text-primary line-through">
								Connect Discogs
							</span>
						</>
					) : (
						<>
							<span className="material-symbols-outlined text-on-surface-variant text-base">
								radio_button_unchecked
							</span>
							<Link
								href="/settings"
								className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
							>
								Connect Discogs
							</Link>
						</>
					)}
				</div>

				{/* Step 2: Follow 3 diggers */}
				<div className="flex items-center gap-2">
					{step2Complete ? (
						<>
							<span className="material-symbols-outlined text-primary text-base">
								check_circle
							</span>
							<span className="font-mono text-xs text-primary line-through">
								Follow 3 diggers
							</span>
						</>
					) : (
						<>
							<span className="material-symbols-outlined text-on-surface-variant text-base">
								radio_button_unchecked
							</span>
							<Link
								href="/explorar"
								className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
							>
								{followingCount > 0
									? `Follow 3 diggers (${followingCount}/3)`
									: "Follow 3 diggers"}
							</Link>
						</>
					)}
				</div>

				{/* Step 3: Join a group (always locked) */}
				<div className="flex items-center gap-2">
					<span className="material-symbols-outlined text-outline text-base">
						lock
					</span>
					<span className="font-mono text-xs text-outline line-through">
						Join a group
					</span>
					<span className="font-mono text-xs text-outline border border-outline-variant/20 px-1.5 py-0.5 rounded">
						[PHASE_7]
					</span>
				</div>
			</div>
		</div>
	);
}
