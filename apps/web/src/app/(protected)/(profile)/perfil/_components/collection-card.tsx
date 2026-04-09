"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
	removeRecordFromCollection,
	setPersonalRating,
	setVisibility,
} from "@/actions/collection";
import { PlayButton } from "@/components/player/play-button";
import { FormatBadge } from "@/components/ui/format-badge";
import { GemBadge } from "@/components/ui/gem-badge";
import { RecordContextMenu } from "@/components/ui/record-context-menu";
import { VisibilitySelector } from "@/components/ui/visibility-selector";
import type { CollectionItem } from "@/lib/collection/queries";
import { getGemTier } from "@/lib/gems/constants";

interface CollectionCardProps {
	item: CollectionItem;
	isOwner: boolean;
}

export function CollectionCard({ item, isOwner }: CollectionCardProps) {
	const tier = getGemTier(item.rarityScore);
	const router = useRouter();
	const [_isRemoving, startRemoveTransition] = useTransition();

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
		<div className="group relative bg-surface-container-low rounded-xl border border-outline-variant/5 hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 transition-all">
			{/* -- Cover -- */}
			<Link
				href={item.discogsId ? `/release/${item.discogsId}` : "#"}
				className="block relative aspect-square bg-surface-container-high overflow-hidden rounded-t-xl"
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
						<span className="material-symbols-outlined text-4xl text-on-surface-variant/15">
							album
						</span>
					</div>
				)}

				{/* Overlays on cover */}
				<div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

				{/* Rarity -- always visible bottom-left */}
				{tier && (
					<div className="absolute bottom-2 left-2 z-10">
						<GemBadge score={item.rarityScore} />
					</div>
				)}

				{/* Play -- hover bottom-right */}
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

				{/* Visibility badge -- top-right */}
				{item.visibility === "tradeable" && (
					<span className="absolute top-2 right-2 z-10 font-mono text-[8px] font-bold bg-primary text-background px-2 py-0.5 rounded-full shadow">
						TRADING
					</span>
				)}
				{item.visibility === "private" && (
					<span className="absolute top-2 right-2 z-10 inline-flex items-center gap-0.5 font-mono text-[8px] font-bold bg-surface-dim/70 text-on-surface-variant/60 px-2 py-0.5 rounded-full backdrop-blur-sm shadow">
						<span className="material-symbols-outlined text-[10px]">lock</span>
						PRIVATE
					</span>
				)}

				{/* Condition -- top-left when set */}
				{item.conditionGrade && (
					<span className="absolute top-2 left-2 z-10 font-mono text-[9px] font-bold bg-surface-dim/70 text-on-surface px-1.5 py-0.5 rounded backdrop-blur-sm">
						{item.conditionGrade}
					</span>
				)}
			</Link>

			{/* -- Info -- */}
			<div className="px-3 pt-2.5 pb-2.5 space-y-1.5">
				{/* Row 1: Title + menu */}
				<div className="flex items-start justify-between gap-1.5">
					<Link
						href={item.discogsId ? `/release/${item.discogsId}` : "#"}
						className="min-w-0 flex-1"
					>
						<h3 className="font-heading text-sm font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug">
							{item.title}
						</h3>
					</Link>
					<RecordContextMenu
						discogsId={item.discogsId}
						title={item.title}
						artist={item.artist}
						hideAdd
						hideWantlist
						onSetVisibility={
							isOwner
								? async (v: string) => {
										const r = await setVisibility(item.id, v);
										if (r.success) {
											toast.success(
												v === "tradeable"
													? "Open for trade!"
													: v === "private"
														? "Made private"
														: "Not trading",
											);
											router.refresh();
										}
									}
								: undefined
						}
						currentVisibility={item.visibility}
						onRemove={isOwner ? handleRemove : undefined}
					/>
				</div>

				{/* Row 2: Artist + format */}
				<div className="flex items-center gap-2">
					<p className="font-mono text-[11px] text-primary/50 truncate">{item.artist}</p>
					<FormatBadge format={item.format} />
				</div>

				{/* Divider */}
				<div className="border-t border-outline-variant/8" />

				{/* Row 3: Star rating + visibility selector */}
				{isOwner && (
					<div className="flex items-center justify-between">
						<div className="flex items-center">
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
											? "text-amber-400"
											: "text-on-surface-variant/20 hover:text-amber-400/50"
									}`}
								>
									<span className="material-symbols-outlined text-[14px]">
										{star <= (item.personalRating ?? 0) ? "star" : "star_border"}
									</span>
								</button>
							))}
						</div>
						<VisibilitySelector
							itemId={item.id}
							currentVisibility={item.visibility}
							compact
						/>
					</div>
				)}

				{/* Notes -- compact, owner only */}
				{isOwner && item.notes && (
					<p
						className="font-mono text-[9px] text-on-surface-variant/40 truncate"
						title={item.notes}
					>
						{item.notes}
					</p>
				)}

				{/* Visitor: trade badge */}
				{!isOwner && item.visibility === "tradeable" && (
					<span className="inline-block font-mono text-[9px] text-primary bg-primary/8 border border-primary/15 px-2 py-0.5 rounded-full">
						Open for trade
					</span>
				)}
			</div>
		</div>
	);
}
