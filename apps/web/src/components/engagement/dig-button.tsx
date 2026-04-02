"use client";

import { useState, useOptimistic, useTransition } from "react";
import { toggleDig } from "@/actions/engagement";
import { usePlayerStore, type PlayerTrack } from "@/lib/player/store";
import { cn } from "@/lib/utils";

interface DigButtonProps {
	feedItemId: string;
	initialDug: boolean;
	initialCount: number;
	/** If provided, Dig! also adds the track to the player queue */
	track?: PlayerTrack;
}

export function DigButton({ feedItemId, initialDug, initialCount, track }: DigButtonProps) {
	const [dug, setDug] = useState(initialDug);
	const [digCount, setDigCount] = useState(initialCount);
	const [isPending, startTransition] = useTransition();
	const [optimisticDug, setOptimisticDug] = useOptimistic(dug);
	const addToQueue = usePlayerStore((s) => s.addToQueue);

	function handleToggle() {
		setOptimisticDug(!optimisticDug);

		startTransition(async () => {
			const result = await toggleDig(feedItemId);
			if (!result.error) {
				setDug(result.dug);
				setDigCount(result.digCount);
				// Add to queue when digging (not un-digging) and track has a videoId
				if (result.dug && track?.videoId) {
					addToQueue(track);
				}
			} else {
				setOptimisticDug(dug);
			}
		});
	}

	return (
		<button
			type="button"
			onClick={handleToggle}
			disabled={isPending}
			className={cn(
				"flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
				optimisticDug
					? "bg-primary/15 text-primary border border-primary/30"
					: "bg-surface-container-high/50 text-on-surface-variant border border-transparent hover:border-outline-variant/20 hover:bg-surface-container-high",
				isPending && "opacity-70",
			)}
			aria-label={optimisticDug ? "Remove dig" : "Dig this find"}
		>
			<span
				className={cn(
					"material-symbols-outlined text-base transition-transform",
					optimisticDug && "scale-110",
				)}
				style={optimisticDug ? { fontVariationSettings: "'FILL' 1" } : undefined}
			>
				thumb_up
			</span>
			<span>Dig!</span>
			{digCount > 0 && (
				<span className={cn(
					"text-xs",
					optimisticDug ? "text-primary/70" : "text-on-surface-variant/60",
				)}>
					{digCount}
				</span>
			)}
		</button>
	);
}
