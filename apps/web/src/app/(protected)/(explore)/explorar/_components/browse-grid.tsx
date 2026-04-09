"use client";

import { useEffect, useState, useTransition } from "react";
import { browseRecordsAction } from "@/actions/discovery";
import { CoverArt } from "@/components/ui/cover-art";
import { GemBadge } from "@/components/ui/gem-badge";
import { PlayOverlay } from "@/components/ui/play-overlay";
import { RecordContextMenu } from "@/components/ui/record-context-menu";
import { RecordLink } from "@/components/ui/record-link";
import type { BrowseResult } from "@/lib/discovery/queries";

interface BrowseGridProps {
	genre: string | null;
	decade: string | null;
	genres?: string[];
	styles?: string[];
	country?: string | null;
	label?: string | null;
	format?: string | null;
	minRarity?: number;
	sort?: string;
	yearFrom?: number | null;
	yearTo?: number | null;
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
	sort = "rarity",
	yearFrom = null,
	yearTo = null,
}: BrowseGridProps) {
	const [results, setResults] = useState<BrowseResult[]>([]);
	const [hasQueried, setHasQueried] = useState(false);
	const [isPending, startTransition] = useTransition();

	const hasAnyFilter =
		!!genre ||
		!!decade ||
		genres.length > 0 ||
		styles.length > 0 ||
		!!country ||
		!!label ||
		!!format ||
		minRarity > 0 ||
		!!yearFrom ||
		!!yearTo;

	useEffect(() => {
		if (!hasAnyFilter) {
			setResults([]);
			setHasQueried(false);
			return;
		}

		startTransition(async () => {
			const data = await browseRecordsAction(
				genre,
				decade,
				1,
				genres,
				country,
				format,
				minRarity,
				styles,
				label,
				sort,
				yearFrom,
				yearTo,
			);
			setResults(data);
			setHasQueried(true);
		});
	}, [
		genre,
		decade,
		genres,
		styles,
		country,
		label,
		format,
		minRarity,
		sort,
		yearFrom,
		yearTo,
		hasAnyFilter,
	]);

	if (!hasAnyFilter) return null;

	if (isPending) {
		return (
			<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
				{Array.from({ length: 8 }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: static list
						key={`skeleton-browse-${i}`}
						className="bg-surface-container-low rounded-xl h-56 animate-pulse"
					/>
				))}
			</div>
		);
	}

	if (hasQueried && results.length === 0) {
		return (
			<div className="text-center py-12 border border-dashed border-outline-variant/20 rounded-xl">
				<span className="material-symbols-outlined text-2xl text-on-surface-variant/20 block mb-2">
					search_off
				</span>
				<p className="font-mono text-xs text-on-surface-variant">
					No records match the selected filters
				</p>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
			{results.map((record) => (
				<div
					key={record.id}
					className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all group"
				>
					{/* Cover with play overlay */}
					<RecordLink
						discogsId={record.discogsId}
						className="block relative aspect-square group/cover"
					>
						<CoverArt
							src={record.coverImageUrl}
							alt={record.title}
							size="full"
							containerClassName="w-full h-full"
						/>
						<PlayOverlay
							videoId={record.youtubeVideoId}
							title={record.title}
							artist={record.artist}
							coverUrl={record.coverImageUrl}
						/>
					</RecordLink>

					{/* Info */}
					<div className="p-3">
						<div className="flex items-start justify-between gap-1">
							<RecordLink discogsId={record.discogsId}>
								<h3 className="font-heading text-xs font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
									{record.title}
								</h3>
							</RecordLink>
							<RecordContextMenu
								discogsId={record.discogsId}
								releaseId={record.id}
								title={record.title}
								artist={record.artist}
							/>
						</div>
						<p className="font-mono text-[10px] text-on-surface-variant truncate mt-0.5">
							{record.artist}
						</p>
						<div className="flex items-center justify-between mt-2">
							<GemBadge score={record.rarityScore} />
							<span className="font-mono text-[9px] text-on-surface-variant/50">
								{record.ownerCount} {record.ownerCount === 1 ? "owner" : "owners"}
							</span>
						</div>
						{record.isOwned && (
							<span className="inline-block mt-1.5 font-mono text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
								IN COLLECTION
							</span>
						)}
					</div>
				</div>
			))}
		</div>
	);
}
