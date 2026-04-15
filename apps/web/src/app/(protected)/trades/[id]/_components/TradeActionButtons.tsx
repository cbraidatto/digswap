"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { acceptTradeAction, cancelTradeAction, declineTradeAction } from "@/actions/trades";

interface Props {
	tradeId: string;
	status: string;
	/** true when the current user is the provider (recipient of the request) */
	isProvider: boolean;
	/** When true, the proposal flow handles accept/decline — hide legacy buttons */
	hasProposals?: boolean;
}

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

export function TradeActionButtons({ tradeId, status, isProvider, hasProposals }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	if (TERMINAL_STATUSES.has(status)) return null;

	async function handleAction(
		action: (id: string) => Promise<{ success: boolean; error?: string }>,
	) {
		setError(null);
		startTransition(async () => {
			const result = await action(tradeId);
			if (!result.success) {
				setError(result.error ?? "Something went wrong.");
			} else {
				router.refresh();
			}
		});
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 flex-wrap">
				{/* Provider can accept/decline a pending trade — only if no proposal flow */}
				{isProvider && status === "pending" && !hasProposals && (
					<>
						<button
							type="button"
							disabled={isPending}
							onClick={() => handleAction(acceptTradeAction)}
							className="font-mono text-xs font-bold px-4 py-2 rounded bg-primary text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
						>
							{isPending ? "..." : "Accept"}
						</button>
						<button
							type="button"
							disabled={isPending}
							onClick={() => handleAction(declineTradeAction)}
							className="font-mono text-xs font-bold px-4 py-2 rounded border border-outline-variant text-muted-foreground hover:text-foreground hover:border-outline disabled:opacity-50 transition-colors"
						>
							{isPending ? "..." : "Decline"}
						</button>
					</>
				)}

				{/* Either participant can cancel non-terminal trades */}
				{(status === "pending" || status === "accepted" || status === "lobby") && (
					<button
						type="button"
						disabled={isPending}
						onClick={() => handleAction(cancelTradeAction)}
						className="font-mono text-xs px-4 py-2 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
					>
						{isPending ? "..." : "Cancel Trade"}
					</button>
				)}
			</div>

			{error && <p className="font-mono text-xs text-destructive">{error}</p>}
		</div>
	);
}
