"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ReactNode } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { getRarityTier } from "@/lib/collection/rarity";
import { ConditionEditor } from "./condition-editor";
import { PlayButton } from "@/components/player/play-button";
import { removeRecordFromCollection, toggleOpenForTrade, setPersonalRating } from "@/actions/collection";
import { RarityPill } from "@/components/ui/rarity-pill";
import { RecordContextMenu } from "@/components/ui/record-context-menu";

interface CollectionCardProps {
	item: CollectionItem;
	isOwner: boolean;
	actionSlot?: ReactNode;
}

export function CollectionCard({ item, isOwner, actionSlot }: CollectionCardProps) {
	const tier = getRarityTier(item.rarityScore);
	const router = useRouter();
	const [isRemoving, startRemoveTransition] = useTransition();

	function handleRemove() {
		if (!confirm("Remove this record from your collection?")) return;
		startRemoveTransition(async () => {
			const result = await removeRecordFromCollection(item.id);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Removed from collection");
				router.refresh();
			}
		});
	}

	return (
		<div className="group bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 transition-all hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5">
			{/* Cover */}
			<Link
				href={item.discogsId ? `/release/${item.discogsId}` : "#"}
				className="block relative aspect-square bg-surface-container-high group/cover"
			>
				{item.coverImageUrl ? (
					<Image
						src={item.coverImageUrl}
						alt={`${item.title} by ${item.artist}`}
						fill
						sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
						className="object-cover"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="material-symbols-outlined text-4xl text-on-surface-variant/20">album</span>
					</div>
				)}

				{/* Rarity pill — bottom left */}
				{tier && (
					<div className="absolute bottom-2 left-2">
						<RarityPill score={item.rarityScore} showScore={false} />
					</div>
				)}

				{/* Play button — bottom right on hover */}
				{item.youtubeVideoId && (
					<div className="absolute bottom-2 right-2 opacity-0 group-hover/cover:opacity-100 transition-opacity">
						<PlayButton
							videoId={item.youtubeVideoId}
							title={item.title}
							artist={item.artist}
							coverUrl={item.coverImageUrl}
							size="sm"
						/>
					</div>
				)}

				{/* Trade badge overlay — top right */}
				{item.openForTrade === 1 && (
					<div className="absolute top-2 right-2">
						<span className="font-mono text-[8px] bg-primary/80 text-background px-1.5 py-0.5 rounded-full">
							TRADING
						</span>
					</div>
				)}
			</Link>

			{/* Info section */}
			<div className="p-2.5">
				{/* Title + context menu */}
				<div className="flex items-start justify-between gap-1 mb-0.5">
					<Link href={item.discogsId ? `/release/${item.discogsId}` : "#"} className="min-w-0">
						<h3 className="font-heading text-xs font-bold text-on-surface hover:text-primary transition-colors line-clamp-1">
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

				{/* Artist */}
				<p className="font-mono text-[10px] text-on-surface-variant truncate">{item.artist}</p>

				{/* Owner controls — compact row */}
				{isOwner && (
					<div className="flex items-center justify-between mt-2 pt-2 border-t border-outline-variant/5">
						{/* Left: condition + trade toggle */}
						<div className="flex items-center gap-1.5">
							<ConditionEditor
								collectionItemId={item.id}
								currentGrade={item.conditionGrade ?? null}
							/>
							<button
								type="button"
								onClick={async () => {
									const result = await toggleOpenForTrade(item.id, !item.openForTrade);
									if (result.success) {
										toast.success(item.openForTrade ? "Removed from trades" : "Open for trade!");
										router.refresh();
									}
								}}
								className={`p-1 rounded transition-colors ${
									item.openForTrade
										? "text-primary bg-primary/10"
										: "text-on-surface-variant/30 hover:text-primary"
								}`}
								title={item.openForTrade ? "Remove from trades" : "Open for trade"}
							>
								<span className="material-symbols-outlined text-[14px]">swap_horiz</span>
							</button>
						</div>

						{/* Right: stars */}
						<div className="flex items-center">
							{[1, 2, 3, 4, 5].map((star) => (
								<button
									key={star}
									type="button"
									onClick={async () => {
										const newRating = item.personalRating === star ? null : star;
										const result = await setPersonalRating(item.id, newRating);
										if (result.success) router.refresh();
									}}
									className={`transition-colors ${
										star <= (item.personalRating ?? 0)
											? "text-primary"
											: "text-on-surface-variant/15 hover:text-primary/40"
									}`}
								>
									<span className="material-symbols-outlined text-[13px]">
										{star <= (item.personalRating ?? 0) ? "star" : "star_border"}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Trade badge — visible to visitors */}
				{!isOwner && item.openForTrade === 1 && (
					<div className="mt-1.5">
						<span className="font-mono text-[8px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
							Open for trade
						</span>
					</div>
				)}

				{actionSlot}
			</div>
		</div>
	);
}
