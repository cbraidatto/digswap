"use client";

import { Disc3 } from "lucide-react";

import { Button } from "@/components/ui/button";

interface DiscogsConnectProps {
	onSkip: () => void;
}

/**
 * Onboarding Step 3: Discogs connection placeholder.
 *
 * Per UI-SPEC:
 * - Title: "Connect Discogs"
 * - Body: "Link your Discogs account to import your collection and wantlist. You can always do this later."
 * - Primary CTA: "Connect Discogs" -- DISABLED/placeholder for Phase 1
 * - Secondary CTA: "Skip for Now" -> advances to completion
 *
 * Discogs integration is Phase 3 work -- this step just establishes the onboarding slot.
 */
export function DiscogsConnect({ onSkip }: DiscogsConnectProps) {
	return (
		<div className="space-y-6">
			<div className="flex flex-col items-center gap-4">
				<div className="flex size-16 items-center justify-center rounded-full bg-primary/10">
					<Disc3 className="size-8 text-primary" />
				</div>
				<p className="text-center text-sm text-muted-foreground">
					Link your Discogs account to import your collection and wantlist.
					You can always do this later.
				</p>
			</div>

			<div className="space-y-3">
				<Button
					className="h-11 w-full"
					disabled
					title="Coming soon in Phase 3"
				>
					Connect Discogs
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
