interface Track {
	position: string;
	title: string;
	duration: string;
}

interface TracklistSectionProps {
	tracklist: unknown;
}

function isTrackArray(value: unknown): value is Track[] {
	return Array.isArray(value) && value.length > 0 && typeof value[0] === "object";
}

export function TracklistSection({ tracklist }: TracklistSectionProps) {
	if (!isTrackArray(tracklist) || tracklist.length === 0) return null;

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="material-symbols-outlined text-sm text-primary">queue_music</span>
				<span className="font-mono text-xs text-primary tracking-[0.2em]">TRACKLIST</span>
				<span className="font-mono text-xs text-on-surface-variant bg-surface-container-high rounded-full px-2 py-0.5">
					{tracklist.length}
				</span>
			</div>

			<div className="bg-surface-container-low rounded border border-outline-variant/10 divide-y divide-outline-variant/5">
				{tracklist.map((track, idx) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={`${track.position}-${idx}`}
						className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/50 transition-colors"
					>
						{/* Position / number */}
						<span className="font-mono text-xs text-on-surface-variant/50 w-6 text-right flex-shrink-0">
							{track.position || String(idx + 1)}
						</span>

						{/* Title */}
						<span className="font-mono text-xs text-on-surface flex-1 truncate">{track.title}</span>

						{/* Duration */}
						{track.duration && (
							<span className="font-mono text-[10px] text-on-surface-variant/50 flex-shrink-0 tabular-nums">
								{track.duration}
							</span>
						)}
					</div>
				))}
			</div>
		</section>
	);
}
