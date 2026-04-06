"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { initiateTradeAction } from "@/actions/trades";

interface ProposeTradeButtonProps {
	providerId: string;
	releaseId?: string;
	/** Compact mode for inline use (owners list) */
	compact?: boolean;
}

export function ProposeTradeButton({
	providerId,
	releaseId,
	compact = false,
}: ProposeTradeButtonProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		setError(null);
		startTransition(async () => {
			const result = await initiateTradeAction({
				providerId,
				releaseId,
			});

			if ("error" in result) {
				setError(result.error);
				return;
			}

			router.push(`/trades/${result.tradeId}`);
		});
	}

	if (compact) {
		return (
			<>
				<button
					type="button"
					onClick={handleClick}
					disabled={isPending}
					title="Propose a trade"
					className="p-1.5 rounded text-on-surface-variant hover:text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
				>
					<span className="material-symbols-outlined text-base">
						{isPending ? "hourglass_top" : "swap_horiz"}
					</span>
				</button>
				{error && (
					<span className="font-mono text-[9px] text-destructive block mt-0.5">
						{error}
					</span>
				)}
			</>
		);
	}

	return (
		<div>
			<button
				type="button"
				onClick={handleClick}
				disabled={isPending}
				className="inline-flex items-center gap-2 bg-primary text-background hover:opacity-90 font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-opacity h-11 md:h-8 disabled:opacity-50"
			>
				<span className="material-symbols-outlined text-[16px]">swap_horiz</span>
				{isPending ? "..." : "PROPOSE TRADE"}
			</button>
			{error && (
				<p className="font-mono text-xs text-destructive mt-1">{error}</p>
			)}
		</div>
	);
}
