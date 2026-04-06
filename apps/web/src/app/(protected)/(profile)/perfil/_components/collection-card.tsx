"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { getRarityTier, getRarityBadgeVariant } from "@/lib/collection/rarity";
import { ConditionEditor } from "./condition-editor";
import { PlayButton } from "@/components/player/play-button";
import { SpinningLogButton } from "@/components/engagement/spinning-log-button";
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
		<div className="group bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
		{/* Aspect-ratio cover container — PlayButton overlays on hover */}
		<div className="relative aspect-square bg-surface-container-high group/cover">
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
						<span className="material-symbols-outlined text-4xl text-on-surface-variant/30">
							album
						</span>
					</div>
				)}

				{/* Rarity badge */}
				{tier && (
					<div className="absolute bottom-2 left-2">
						<Badge variant={getRarityBadgeVariant(tier)} className="text-xs">
							{tier}
						</Badge>
					</div>
				)}

				{/* Play button — appears on hover */}
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
			</div>

			{/* Info */}
			<div className="p-3">
				<div className="flex items-start justify-between gap-1">
					<Link href={item.discogsId ? `/release/${item.discogsId}` : "#"}>
						<h3 className="font-heading text-sm font-bold text-on-surface hover:text-primary transition-colors truncate">
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
				<p className="text-xs text-on-surface-variant truncate mb-1">{item.artist}</p>
				{/* Condition editor — only visible to owner */}
				{isOwner && (
					<ConditionEditor
						collectionItemId={item.id}
						currentGrade={item.conditionGrade ?? null}
					/>
				)}
				{/* Spinning Log — only visible to owner */}
				{isOwner && item.releaseId && (
					<SpinningLogButton
						releaseId={item.releaseId}
						releaseTitle={item.title}
					/>
				)}
				{/* Trade toggle + Rating — only visible to owner */}
				{isOwner && (
					<div className="flex items-center gap-2 mt-1.5">
						{/* Open for Trade toggle */}
						<button
							type="button"
							onClick={async () => {
								const result = await toggleOpenForTrade(item.id, !item.openForTrade);
								if (result.success) {
									toast.success(item.openForTrade ? "Removed from trades" : "Open for trade!");
									router.refresh();
								}
							}}
							className={`font-mono text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
								item.openForTrade
									? "bg-primary/10 text-primary border-primary/30"
									: "text-on-surface-variant/40 border-outline-variant/20 hover:text-primary hover:border-primary/30"
							}`}
							title={item.openForTrade ? "Remove from trades" : "Mark as open for trade"}
						>
							<span className="material-symbols-outlined text-[12px] align-middle mr-0.5">swap_horiz</span>
							{item.openForTrade ? "Trading" : "Trade"}
						</button>

						{/* Personal rating */}
						<div className="flex items-center gap-0.5">
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
											: "text-on-surface-variant/20 hover:text-primary/50"
									}`}
								>
									<span className="material-symbols-outlined text-[12px]">
										{star <= (item.personalRating ?? 0) ? "star" : "star_border"}
									</span>
								</button>
							))}
						</div>
					</div>
				)}

				{/* Trade badge — visible to visitors on public profile */}
				{!isOwner && item.openForTrade === 1 && (
					<span className="inline-block mt-1.5 font-mono text-[9px] text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full">
						<span className="material-symbols-outlined text-[10px] align-middle mr-0.5">swap_horiz</span>
						Open for trade
					</span>
				)}

				{/* Remove — only visible to owner */}
				{isOwner && (
					<button
						type="button"
						onClick={handleRemove}
						disabled={isRemoving}
						className="mt-1 font-mono text-[10px] text-on-surface-variant/50 hover:text-destructive transition-colors disabled:opacity-50"
					>
						{isRemoving ? "Removing..." : "Remove"}
					</button>
				)}
				{actionSlot}
			</div>
		</div>
	);
}
