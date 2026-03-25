"use client";

import { useTransition } from "react";
import { Disc3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { connectDiscogs } from "@/actions/discogs";

interface DiscogsConnectProps {
	onSkip: () => void;
}

/**
 * Onboarding Step 3: Discogs connection.
 *
 * Per UI-SPEC:
 * - Title: "Connect Discogs"
 * - Body: "Link your Discogs account to import your collection and wantlist. You can always do this later."
 * - Primary CTA: "Connect Discogs" -- initiates OAuth 1.0a flow
 * - Secondary CTA: "Skip for Now" -> advances to completion
 *
 * Phase 3 activates the previously-disabled button with a real OAuth flow.
 * The connectDiscogs server action redirects to Discogs for authorization.
 */
export function DiscogsConnect({ onSkip }: DiscogsConnectProps) {
	const [isPending, startTransition] = useTransition();

	const handleConnect = () => {
		startTransition(async () => {
			try {
				await connectDiscogs();
				// redirect happens inside the server action, this line won't be reached
			} catch (error) {
				// redirect() throws a special NEXT_REDIRECT error -- only show toast for real errors
				const message =
					error instanceof Error ? error.message : String(error);
				if (!message.includes("NEXT_REDIRECT")) {
					toast.error("Could not connect to Discogs. Please try again.");
				}
			}
		});
	};

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
					onClick={handleConnect}
					disabled={isPending}
				>
					{isPending ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							Connecting...
						</>
					) : (
						"Connect Discogs"
					)}
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
