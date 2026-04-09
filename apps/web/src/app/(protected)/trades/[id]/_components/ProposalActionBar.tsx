"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
	acceptProposalAction,
	declineProposalAction,
} from "@/actions/trade-proposals";
import type { ProposalWithItems } from "@/lib/trades/proposal-queries";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProposalActionBarProps {
	proposal: ProposalWithItems;
	tradeId: string;
	currentUserId: string;
	counterpartyId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProposalActionBar({
	proposal,
	tradeId,
	currentUserId,
	counterpartyId,
}: ProposalActionBarProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	// Proposer cannot act on their own proposal
	if (proposal.proposerId === currentUserId) return null;

	async function handleAccept() {
		setError(null);
		startTransition(async () => {
			const result = await acceptProposalAction(proposal.id);
			if (!result.success) {
				setError(result.error ?? "Failed to accept proposal.");
			} else {
				router.refresh();
			}
		});
	}

	async function handleDecline() {
		setError(null);
		startTransition(async () => {
			const result = await declineProposalAction(proposal.id);
			if (!result.success) {
				setError(result.error ?? "Failed to decline proposal.");
			} else {
				router.refresh();
			}
		});
	}

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-2 flex-wrap">
				{/* Accept */}
				<button
					type="button"
					disabled={isPending}
					onClick={handleAccept}
					className="font-mono text-xs font-bold px-4 py-2 rounded bg-primary text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
				>
					{isPending ? "..." : "Accept"}
				</button>

				{/* Decline */}
				<button
					type="button"
					disabled={isPending}
					onClick={handleDecline}
					className="font-mono text-xs font-bold px-4 py-2 rounded border border-outline-variant text-muted-foreground hover:text-foreground hover:border-outline disabled:opacity-50 transition-colors"
				>
					{isPending ? "..." : "Decline"}
				</button>

				{/* Counter */}
				<Link
					href={`/trades/new/${counterpartyId}?tradeId=${tradeId}`}
					className="font-mono text-xs font-bold px-4 py-2 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1.5"
				>
					<span className="material-symbols-outlined text-sm">reply</span>
					Counter
				</Link>
			</div>

			{error && (
				<p className="font-mono text-xs text-destructive">{error}</p>
			)}
		</div>
	);
}
