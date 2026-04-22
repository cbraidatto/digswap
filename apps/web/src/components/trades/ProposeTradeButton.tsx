"use client";

import Link from "next/link";

interface ProposeTradeButtonProps {
	providerId: string;
	releaseId?: string;
	/** Compact mode for inline use (owners list) */
	compact?: boolean;
}

export function ProposeTradeButton({ providerId, compact = false }: ProposeTradeButtonProps) {
	if (compact) {
		return (
			<Link
				href={`/trades/new/${providerId}`}
				title="Propose a trade"
				className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
			>
				<span className="material-symbols-outlined text-base">swap_horiz</span>
			</Link>
		);
	}

	return (
		<Link
			href={`/trades/new/${providerId}`}
			className="inline-flex items-center gap-2 bg-primary text-background hover:opacity-90 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-opacity h-11 md:h-8"
		>
			<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
			PROPOSE TRADE
		</Link>
	);
}
