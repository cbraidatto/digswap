"use client";

import { useState } from "react";

interface Track {
	position: string;
	title: string;
	duration: string;
}

interface InlineTracklistProps {
	tracks: Track[];
	initialVisible?: number;
}

export function InlineTracklist({ tracks, initialVisible = 3 }: InlineTracklistProps) {
	const [expanded, setExpanded] = useState(false);
	const visible = expanded ? tracks : tracks.slice(0, initialVisible);
	const hasMore = tracks.length > initialVisible;

	return (
		<div className="space-y-0.5">
			{visible.map((track, i) => {
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={`${track.position}-${i}`}
						className="flex items-center gap-2 font-mono text-[10px]"
					>
						<span className="text-on-surface-variant/40 w-4 flex-shrink-0 text-right">
							{track.position || String(i + 1)}
						</span>
						<span className="text-on-surface/80 truncate flex-1">{track.title}</span>
						{track.duration && (
							<span className="text-on-surface-variant/30 flex-shrink-0">{track.duration}</span>
						)}
					</div>
				);
			})}
			{hasMore && !expanded && (
				<button
					type="button"
					onClick={() => setExpanded(true)}
					className="font-mono text-[9px] text-primary/70 hover:text-primary transition-colors mt-0.5"
				>
					see all ({tracks.length})
				</button>
			)}
		</div>
	);
}
