import Image from "next/image";
import type { ReactNode } from "react";
import { PlayButton } from "@/components/player/play-button";
import { getCardVariant } from "@/lib/collection/format-utils";
import type { CollectionItem } from "@/lib/collection/queries";
import { CollectionCard } from "./collection-card";
import { CollectionCardExpanded } from "./collection-card-expanded";

export type ViewMode = "grid" | "list";

interface CollectionGridProps {
	items: CollectionItem[];
	isOwner: boolean;
	/** @deprecated Use RecordContextMenu instead */
	renderAction?: (item: CollectionItem) => ReactNode;
	/** When set, only renders items whose releaseId is in this array (client-side filter). */
	filterToIds?: string[];
	/** Display mode: 'list' = full card (default), 'grid' = cover-only thumbnails */
	viewMode?: ViewMode;
}

export function CollectionGrid({
	items,
	isOwner,
	renderAction,
	filterToIds,
	viewMode = "list",
}: CollectionGridProps) {
	const displayItems =
		filterToIds && filterToIds.length > 0
			? items.filter((item) => filterToIds.includes(item.releaseId))
			: items;

	if (displayItems.length === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center gap-4 text-center border border-outline-variant/10">
				<div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center">
					<span className="material-symbols-outlined text-primary text-3xl">album</span>
				</div>
				<div>
					<div className="text-xs font-mono text-primary uppercase tracking-widest mb-2">
						EMPTY_REPOSITORY
					</div>
					<h3 className="text-lg font-bold font-heading text-on-surface mb-2">No records found</h3>
					<p className="text-sm text-on-surface-variant font-sans max-w-sm">
						Connect Discogs or add records manually to start building your collection.
					</p>
				</div>
			</div>
		);
	}

	// ── Grid view: covers only ──────────────────────────────────────────────
	if (viewMode === "grid") {
		return (
			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
				{displayItems.map((item) => (
					<div
						key={item.id}
						className="group relative aspect-square bg-surface-container-high rounded overflow-hidden"
						title={`${item.title} – ${item.artist}`}
					>
						{item.coverImageUrl ? (
							<Image
								src={item.coverImageUrl}
								alt={`${item.title} by ${item.artist}`}
								fill
								sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
								className="w-full object-cover"
							/>
						) : (
							<div className="absolute inset-0 flex items-center justify-center">
								<span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
									album
								</span>
							</div>
						)}

						{/* Hover overlay with title + play button */}
						<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-start justify-end p-2 gap-1">
							<p className="font-heading text-xs font-bold text-white line-clamp-1 leading-tight w-full">
								{item.title}
							</p>
							<p className="font-mono text-[10px] text-white/70 line-clamp-1 w-full">
								{item.artist}
							</p>
							{item.youtubeVideoId && (
								<div className="mt-0.5">
									<PlayButton
										videoId={item.youtubeVideoId}
										title={item.title}
										artist={item.artist}
										coverUrl={item.coverImageUrl}
										size="sm"
									/>
								</div>
							)}
						</div>
					</div>
				))}
			</div>
		);
	}

	// ── List view: full cards with format-based variants ──────────────────
	return (
		<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
			{displayItems.map((item) => {
				const variant = getCardVariant(item.format, item.tracklist);
				if (variant !== "compact") {
					return (
						<div key={item.id} className="col-span-2">
							<CollectionCardExpanded item={item} isOwner={isOwner} variant={variant} />
						</div>
					);
				}
				return <CollectionCard key={item.id} item={item} isOwner={isOwner} />;
			})}
		</div>
	);
}
