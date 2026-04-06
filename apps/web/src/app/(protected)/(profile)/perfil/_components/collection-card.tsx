"use client";

import { useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CollectionItem } from "@/lib/collection/queries";
import { getRarityTier } from "@/lib/collection/rarity";
import { PlayButton } from "@/components/player/play-button";
import { removeRecordFromCollection, toggleOpenForTrade, setPersonalRating, updateCollectionNotes } from "@/actions/collection";
import { RarityPill } from "@/components/ui/rarity-pill";
import { RecordContextMenu } from "@/components/ui/record-context-menu";

interface CollectionCardProps {
	item: CollectionItem;
	isOwner: boolean;
}

export function CollectionCard({ item, isOwner }: CollectionCardProps) {
	const tier = getRarityTier(item.rarityScore);
	const router = useRouter();
	const [isRemoving, startRemoveTransition] = useTransition();

	function handleRemove() {
		if (!confirm("Remove this record from your collection?")) return;
		startRemoveTransition(async () => {
			const result = await removeRecordFromCollection(item.id);
			if (result.error) toast.error(result.error);
			else { toast.success("Removed"); router.refresh(); }
		});
	}

	return (
		<div className="group bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all">
			{/* ── Cover ── */}
			<Link
				href={item.discogsId ? `/release/${item.discogsId}` : "#"}
				className="block relative aspect-square bg-surface-container-high"
			>
				{item.coverImageUrl ? (
					<Image
						src={item.coverImageUrl}
						alt={`${item.title} by ${item.artist}`}
						fill
						sizes="(max-width: 768px) 50vw, 25vw"
						className="object-cover"
					/>
				) : (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="material-symbols-outlined text-4xl text-on-surface-variant/15">album</span>
					</div>
				)}

				{/* Overlays on cover */}
				<div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

				{/* Rarity — always visible bottom-left */}
				{tier && (
					<div className="absolute bottom-2 left-2 z-10">
						<RarityPill score={item.rarityScore} showScore={false} />
					</div>
				)}

				{/* Play — hover bottom-right */}
				{item.youtubeVideoId && (
					<div className="absolute bottom-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
						<PlayButton
							videoId={item.youtubeVideoId}
							title={item.title}
							artist={item.artist}
							coverUrl={item.coverImageUrl}
							size="sm"
						/>
					</div>
				)}

				{/* Trading badge — top-right */}
				{item.openForTrade === 1 && (
					<span className="absolute top-2 right-2 z-10 font-mono text-[8px] font-bold bg-primary text-background px-2 py-0.5 rounded-full shadow">
						TRADING
					</span>
				)}

				{/* Condition — top-left when set */}
				{item.conditionGrade && (
					<span className="absolute top-2 left-2 z-10 font-mono text-[9px] font-bold bg-surface-dim/70 text-on-surface px-1.5 py-0.5 rounded backdrop-blur-sm">
						{item.conditionGrade}
					</span>
				)}
			</Link>

			{/* ── Info ── */}
			<div className="px-3 pt-2.5 pb-2">
				{/* Row 1: Title + menu */}
				<div className="flex items-start justify-between gap-1">
					<Link href={item.discogsId ? `/release/${item.discogsId}` : "#"} className="min-w-0 flex-1">
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

				{/* Row 2: Artist */}
				<p className="font-mono text-[10px] text-on-surface-variant/70 truncate mt-0.5">
					{item.artist}
				</p>

				{/* Row 3: Owner actions — single compact row */}
				{isOwner && (
					<div className="flex items-center justify-between mt-2">
						{/* Stars */}
						<div className="flex items-center gap-px">
							{[1, 2, 3, 4, 5].map((star) => (
								<button
									key={star}
									type="button"
									onClick={async () => {
										const r = await setPersonalRating(item.id, item.personalRating === star ? null : star);
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

						{/* Trade toggle + remove */}
						<div className="flex items-center gap-0.5">
							<button
								type="button"
								onClick={async () => {
									const r = await toggleOpenForTrade(item.id, !item.openForTrade);
									if (r.success) { toast.success(item.openForTrade ? "Removed" : "Open for trade!"); router.refresh(); }
								}}
								className={`p-1 rounded-full transition-colors ${
									item.openForTrade
										? "text-primary bg-primary/10"
										: "text-on-surface-variant/25 hover:text-primary"
								}`}
								title={item.openForTrade ? "Remove from trades" : "Open for trade"}
							>
								<span className="material-symbols-outlined text-[14px]">swap_horiz</span>
							</button>
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

				{/* Notes — compact, owner only */}
				{isOwner && item.notes && (
					<p className="font-mono text-[9px] text-on-surface-variant/40 truncate mt-1" title={item.notes}>
						📝 {item.notes}
					</p>
				)}

				{/* Visitor: trade badge */}
				{!isOwner && item.openForTrade === 1 && (
					<div className="mt-2">
						<span className="font-mono text-[8px] text-primary bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded-full">
							Open for trade
						</span>
					</div>
				)}

			</div>
		</div>
	);
}
