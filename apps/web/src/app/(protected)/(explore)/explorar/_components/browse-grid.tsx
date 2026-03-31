"use client";

import { useEffect, useState, useTransition } from "react";
import { browseRecordsAction } from "@/actions/discovery";
import type { BrowseResult } from "@/lib/discovery/queries";
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

interface BrowseGridProps {
	genre: string | null;
	decade: string | null;
}

export function BrowseGrid({ genre, decade }: BrowseGridProps) {
	const [results, setResults] = useState<BrowseResult[]>([]);
	const [hasQueried, setHasQueried] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		// Don't query if no filters selected
		if (!genre && !decade) {
			setResults([]);
			setHasQueried(false);
			return;
		}

		startTransition(async () => {
			const data = await browseRecordsAction(genre, decade);
			setResults(data);
			setHasQueried(true);
		});
	}, [genre, decade]);

	// No filters selected: render nothing
	if (!genre && !decade) {
		return null;
	}

	// Loading state
	if (isPending) {
		return (
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				{Array.from({ length: 4 }).map((_, i) => (
					<div
						key={`skeleton-browse-${i}`}
						className="skeleton-shimmer rounded-lg h-32"
					/>
				))}
			</div>
		);
	}

	// Empty state after filter
	if (hasQueried && results.length === 0) {
		return (
			<div className="text-center py-8">
				<div className="font-mono text-[10px] text-on-surface-variant">
					[NO_RECORDS_FOUND]
				</div>
				<div className="font-mono text-sm text-on-surface-variant mt-2">
					No records match the selected filters. Try a different combination.
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			{results.map((record) => {
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
									className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRarityColors(rarityTier)}`}
								>
									[{rarityTier.toUpperCase()}]
								</span>
							)}
						</div>

						{/* Artist */}
						<div className="font-mono text-[10px] text-on-surface-variant truncate">
							{record.artist}
						</div>

						{/* Owner Count */}
						<div className="font-mono text-[10px] text-on-surface-variant mt-2">
							{record.ownerCount}{" "}
							{record.ownerCount === 1 ? "owner" : "owners"}
						</div>
					</div>
				);
			})}
		</div>
	);
}
