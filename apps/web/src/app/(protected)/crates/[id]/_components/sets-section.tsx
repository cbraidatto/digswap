"use client";

import { useState } from "react";
import type { SetWithTracks } from "@/lib/crates/types";

interface SetsSectionProps {
	sets: SetWithTracks[];
}

interface SetCardProps {
	set: SetWithTracks;
}

function SetCard({ set }: SetCardProps) {
	const [isOpen, setIsOpen] = useState(false);

	const displayDate = set.eventDate
		? new Date(`${set.eventDate}T00:00:00`).toLocaleDateString("en-GB", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "No date";

	const trackCount = set.tracks.length;
	const summary = [
		displayDate,
		set.venueName ?? null,
		`${trackCount} ${trackCount === 1 ? "track" : "tracks"}`,
	]
		.filter(Boolean)
		.join(" · ");

	return (
		<div className="bg-surface-container-low rounded-lg border border-outline-variant/10 p-3">
			<button
				type="button"
				onClick={() => setIsOpen((prev) => !prev)}
				className="w-full flex items-center justify-between text-left"
			>
				<span className="font-mono text-xs text-on-surface-variant">{summary}</span>
				<span className="font-mono text-xs text-primary ml-2 flex-shrink-0">
					{isOpen ? "[−]" : "[+]"}
				</span>
			</button>

			{isOpen && trackCount > 0 && (
				<div className="mt-3 space-y-1 border-t border-outline-variant/10 pt-3">
					{set.tracks.map((track) => (
						<div key={track.id} className="flex items-center gap-2">
							<span className="font-mono text-xs text-on-surface-variant w-4 flex-shrink-0 text-right">
								{track.position}
							</span>
							<span className="font-heading text-xs text-on-surface truncate flex-1">
								{track.item.title ?? "Unknown"}
							</span>
							{track.item.artist && (
								<span className="font-mono text-xs text-on-surface-variant flex-shrink-0 truncate max-w-[120px]">
									{track.item.artist}
								</span>
							)}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function SetsSection({ sets }: SetsSectionProps) {
	if (sets.length === 0) return null;

	return (
		<section className="mt-8">
			<div className="font-mono text-xs text-on-surface-variant tracking-[0.15em] mb-3">[SETS]</div>
			<div className="space-y-2">
				{sets.map((set) => (
					<SetCard key={set.id} set={set} />
				))}
			</div>
		</section>
	);
}
