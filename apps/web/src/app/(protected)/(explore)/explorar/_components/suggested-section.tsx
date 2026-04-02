"use client";

import { useEffect, useState, useTransition } from "react";
import { getSuggestionsAction } from "@/actions/discovery";
import type { SuggestionResult } from "@/lib/discovery/queries";
import { getRarityTier } from "@/lib/collection/rarity";

function getRarityColors(tier: string | null): string {
	switch (tier) {
		case "Ultra Rare":
			return "text-tertiary border-tertiary";
		case "Rare":
			return "text-secondary border-secondary";
		case "Common":
			return "text-on-surface-variant border-outline-variant";
		default:
			return "";
	}
}

export function SuggestedSection() {
	const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
	const [loaded, setLoaded] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		startTransition(async () => {
			try {
				const data = await getSuggestionsAction();
				setSuggestions(data.slice(0, 8));
			} catch {
				// Silently handle - suggestions are non-critical
				setSuggestions([]);
			} finally {
				setLoaded(true);
			}
		});
	}, []);

	return (
		<div>
			{/* Section Header */}
			<div className="font-mono text-xs uppercase tracking-[0.2em] text-outline mb-4">
				SUGGESTED_FOR_YOU
			</div>

			{/* Loading State */}
			{isPending && !loaded && (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, i) => (
						<div
							key={`skeleton-suggest-${i}`}
							className="skeleton-shimmer rounded-lg h-32"
						/>
					))}
				</div>
			)}

			{/* Empty State */}
			{loaded && suggestions.length === 0 && (
				<div className="py-4">
					<div className="font-mono text-xs text-on-surface-variant">
						[NO_SUGGESTIONS_YET]
					</div>
					<div className="font-mono text-sm text-on-surface-variant mt-2">
						Follow more diggers or import your collection to get personalized
						suggestions.
					</div>
				</div>
			)}

			{/* Suggestions Grid */}
			{loaded && suggestions.length > 0 && (
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
					{suggestions.map((record) => {
						const rarityTier = getRarityTier(record.rarityScore);
						return (
							<div
								key={record.id}
								className="bg-surface-container-low rounded-lg p-4 hover:bg-surface-container transition-colors cursor-pointer group"
							>
								{/* Album Art */}
								<div className="w-12 h-12 bg-surface-container-high rounded flex-shrink-0 flex items-center justify-center mb-3">
									{record.coverImageUrl ? (
										<img
											src={record.coverImageUrl}
											alt={record.title}
											className="w-full h-full object-cover rounded"
										/>
									) : (
										<span className="material-symbols-outlined text-on-surface-variant/40 text-xl">
											album
										</span>
									)}
								</div>

								{/* Title + Rarity */}
								<div className="flex flex-wrap items-center gap-2 mb-1">
									<span className="font-heading font-semibold text-on-surface group-hover:text-primary transition-colors truncate text-sm">
										{record.title}
									</span>
									{rarityTier && (
										<span
											className={`text-xs font-mono px-1.5 py-0.5 rounded border ${getRarityColors(rarityTier)}`}
										>
											[{rarityTier.toUpperCase()}]
										</span>
									)}
								</div>

								{/* Artist */}
								<div className="font-mono text-xs text-on-surface-variant truncate">
									{record.artist}
								</div>

								{/* Owner Count */}
								<div className="font-mono text-xs text-on-surface-variant mt-2">
									{record.ownerCount}{" "}
									{record.ownerCount === 1 ? "owner" : "owners"}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
