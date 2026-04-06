"use client";

import { useEffect, useState, useTransition } from "react";
import { browseRecordsAction } from "@/actions/discovery";
import type { BrowseResult } from "@/lib/discovery/queries";
import { getRarityTier } from "@/lib/collection/rarity";
import { CoverArt } from "@/components/ui/cover-art";

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
	genres?: string[];
	styles?: string[];
	country?: string | null;
	label?: string | null;
	format?: string | null;
	minRarity?: number;
}

export function BrowseGrid({
	genre,
	decade,
	genres = [],
	styles = [],
	country = null,
	label = null,
	format = null,
	minRarity = 0,
}: BrowseGridProps) {
	const [results, setResults] = useState<BrowseResult[]>([]);
	const [hasQueried, setHasQueried] = useState(false);
	const [isPending, startTransition] = useTransition();

	const hasAnyFilter =
		!!genre || !!decade || genres.length > 0 || styles.length > 0 || !!country || !!label || !!format || minRarity > 0;

	useEffect(() => {
		// Don't query if no filters selected
		if (!hasAnyFilter) {
			setResults([]);
			setHasQueried(false);
			return;
		}

		startTransition(async () => {
			const data = await browseRecordsAction(genre, decade, 1, genres, country, format, minRarity, styles, label);
			setResults(data);
			setHasQueried(true);
		});
	}, [genre, decade, genres, styles, country, label, format, minRarity, hasAnyFilter]);

	// No filters selected: render nothing
	if (!hasAnyFilter) {
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
				<div className="font-mono text-xs text-on-surface-variant">
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
						<CoverArt
							src={record.coverImageUrl}
							alt={record.title}
							size="md"
							containerClassName="mb-3"
						/>

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
	);
}
