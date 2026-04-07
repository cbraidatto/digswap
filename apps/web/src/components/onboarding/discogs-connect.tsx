"use client";

import { Disc3, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { connectDiscogs } from "@/actions/discogs";
import { Button } from "@/components/ui/button";

/**
 * Onboarding Step 3: Discogs connection.
 *
 * Optional step — user can skip and connect later from Settings.
 * The connectDiscogs server action redirects to Discogs for authorization.
 * After OAuth, the import starts async and user proceeds to completion.
 */
export function DiscogsConnect({ onSkip }: { onSkip?: () => void }) {
	const [isPending, startTransition] = useTransition();

	const handleConnect = () => {
		startTransition(async () => {
			try {
				const result = await connectDiscogs();
				if ("error" in result) {
					toast.error(result.error);
					return;
				}
				window.location.href = result.url;
			} catch {
				toast.error("Could not connect to Discogs. Please try again.");
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
					Link your Discogs account to import your collection and wantlist. Your library powers the
					Radar.
				</p>
			</div>

			<div className="space-y-3">
				<Button className="h-11 w-full" onClick={handleConnect} disabled={isPending}>
					{isPending ? (
						<>
							<Loader2 className="mr-2 size-4 animate-spin" />
							Connecting...
						</>
					) : (
						"Connect Discogs"
					)}
				</Button>

				{onSkip && (
					<button
						type="button"
						onClick={onSkip}
						className="w-full font-mono text-xs text-on-surface-variant hover:text-on-surface transition-colors py-2"
					>
						Skip for now — connect later in Settings
					</button>
				)}

				<p className="font-mono text-xs text-on-surface-variant text-center mt-2">
					<span className="text-tertiary">[OPTIONAL]</span> // Connect Discogs to activate the
					Radar. Without Discogs, the Radar is blind.
				</p>
			</div>
		</div>
	);
}
