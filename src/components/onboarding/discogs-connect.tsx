"use client";

import { useTransition } from "react";
import { Disc3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { connectDiscogs } from "@/actions/discogs";

/**
 * Onboarding Step 3: Discogs connection.
 *
 * Non-skippable step. User must connect Discogs to proceed.
 * The connectDiscogs server action redirects to Discogs for authorization.
 * After OAuth, the import starts async and user proceeds to completion.
 */
export function DiscogsConnect() {
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
					Your library powers the Radar.
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

				<p className="font-mono text-[10px] text-on-surface-variant text-center mt-4">
					<span className="text-tertiary">[REQUIRED]</span> // Connect Discogs to activate the Radar. Without Discogs, the Radar is blind.
				</p>
			</div>
		</div>
	);
}
