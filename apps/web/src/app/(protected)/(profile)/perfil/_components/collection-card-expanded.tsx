"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
	removeRecordFromCollection,
	setPersonalRating,
} from "@/actions/collection";
import { PlayButton } from "@/components/player/play-button";
import { FormatBadge } from "@/components/ui/format-badge";
import { GemBadge } from "@/components/ui/gem-badge";
import { RecordContextMenu } from "@/components/ui/record-context-menu";
import { VisibilitySelector } from "@/components/ui/visibility-selector";
import { WaveformDecoration } from "@/components/ui/waveform-decoration";
import type { CardVariant } from "@/lib/collection/format-utils";
import type { CollectionItem } from "@/lib/collection/queries";
import { getGemTier } from "@/lib/gems/constants";
import { InlineTracklist } from "./inline-tracklist";

interface CollectionCardExpandedProps {
	item: CollectionItem;
	isOwner: boolean;
	variant: CardVariant;
}

export function CollectionCardExpanded({ item, isOwner, variant }: CollectionCardExpandedProps) {
	const tier = getGemTier(item.rarityScore);
	const router = useRouter();
	const [isRemoving, startRemoveTransition] = useTransition();

	const initialVisible = variant === "expanded-ep" ? 2 : 3;

	function handleRemove() {
		if (!confirm("Remove this record from your collection?")) return;
		startRemoveTransition(async () => {
			const result = await removeRecordFromCollection(item.id);
			if (result.error) toast.error(result.error);
			else {
				toast.success("Removed");
				router.refresh();
			}
		});
	}

	return (
		<div className="group bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all">
			<div className="flex gap-3 p-3">
				{/* Cover art */}
				<Link
					href={item.discogsId ? `/release/${item.discogsId}` : "#"}
					className="block relative w-28 h-28 flex-shrink-0 bg-surface-container-high rounded-lg overflow-hidden"
				>
					{item.coverImageUrl ? (
						<Image
							src={item.coverImageUrl}
							alt={`${item.title} by ${item.artist}`}
							fill
							sizes="112px"
							className="object-cover"
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="material-symbols-outlined text-3xl text-on-surface-variant/15">
								album
							</span>
						</div>
					)}

					{/* Rarity badge */}
					{tier && (
						<div className="absolute bottom-1.5 left-1.5 z-10">
							<GemBadge score={item.rarityScore} />
						</div>
					)}

					{/* Play button on hover */}
					{item.youtubeVideoId && (
						<div className="absolute bottom-1.5 right-1.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
							<PlayButton
								videoId={item.youtubeVideoId}
								title={item.title}
								artist={item.artist}
								coverUrl={item.coverImageUrl}
								size="sm"
							/>
						</div>
					)}
				</Link>

				{/* Info + tracklist */}
				<div className="flex-1 min-w-0 flex flex-col">
					{/* Title row */}
					<div className="flex items-start justify-between gap-1">
						<Link
							href={item.discogsId ? `/release/${item.discogsId}` : "#"}
							className="min-w-0 flex-1"
						>
							<h3 className="font-heading text-[13px] font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1 leading-tight">
								{item.title}
							</h3>
						</Link>
						<RecordContextMenu
							discogsId={item.discogsId}
							title={item.title}
							artist={item.artist}
							hideAdd
							hideWantlist
						/>
					</div>

					{/* Artist + badges */}
					<div className="flex items-center gap-2 mt-0.5">
						<p className="font-mono text-[10px] text-on-surface-variant/70 truncate">
							{item.artist}
						</p>
						<FormatBadge format={item.format} />
						{item.year && (
							<span className="font-mono text-[9px] text-on-surface-variant/40">{item.year}</span>
						)}
					</div>

					{/* Visibility badge */}
					{item.visibility === "tradeable" && (
						<span className="inline-flex self-start font-mono text-[8px] font-bold bg-primary text-background px-2 py-0.5 rounded-full mt-1">
							TRADING
						</span>
					)}
					{item.visibility === "private" && (
						<span className="inline-flex self-start items-center gap-0.5 font-mono text-[8px] font-bold bg-surface-dim/70 text-on-surface-variant/60 px-2 py-0.5 rounded-full mt-1">
							<span className="material-symbols-outlined text-[10px]">lock</span>
							PRIVATE
						</span>
					)}

					{/* Tracklist */}
					{item.tracklist && item.tracklist.length > 0 && (
						<div className="mt-2 flex-1 min-h-0 overflow-hidden">
							<InlineTracklist tracks={item.tracklist} initialVisible={initialVisible} />
						</div>
					)}
				</div>
			</div>

			{/* Waveform decoration */}
			<div className="px-3 text-primary/60">
				<WaveformDecoration releaseId={item.releaseId} />
			</div>

			{/* Owner actions */}
			{isOwner && (
				<div className="flex items-center justify-between px-3 pb-2.5 pt-1">
					{/* Stars */}
					<div className="flex items-center gap-px">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								type="button"
								onClick={async () => {
									const r = await setPersonalRating(
										item.id,
										item.personalRating === star ? null : star,
									);
									if (r.success) router.refresh();
								}}
								className={`transition-colors ${
									star <= (item.personalRating ?? 0)
										? "text-primary"
										: "text-on-surface-variant/15 hover:text-primary/40"
								}`}
							>
								<span className="material-symbols-outlined text-[14px]">
									{star <= (item.personalRating ?? 0) ? "star" : "star_border"}
								</span>
							</button>
						))}
					</div>

					{/* Visibility selector + remove */}
					<div className="flex items-center gap-0.5">
						<VisibilitySelector
							itemId={item.id}
							currentVisibility={item.visibility}
							compact
						/>
						<button
							type="button"
							onClick={handleRemove}
							disabled={isRemoving}
							className="p-1 rounded-full text-on-surface-variant/15 hover:text-destructive transition-colors disabled:opacity-50"
							title="Remove from collection"
						>
							<span className="material-symbols-outlined text-[14px]">
								{isRemoving ? "hourglass_top" : "delete"}
							</span>
						</button>
					</div>
				</div>
			)}

			{/* Visitor trade badge */}
			{!isOwner && item.visibility === "tradeable" && (
				<div className="px-3 pb-2.5">
					<span className="font-mono text-[8px] text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
						Open for trade
					</span>
				</div>
			)}
		</div>
	);
}
