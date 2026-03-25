"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { CollectionItem } from "@/lib/collection/queries";
import { getRarityTier, getRarityBadgeVariant } from "@/lib/collection/rarity";

interface CollectionCardProps {
	item: CollectionItem;
	isOwner: boolean;
	onConditionEdit?: (itemId: string) => void;
}

export function CollectionCard({
	item,
	isOwner,
	onConditionEdit,
}: CollectionCardProps) {
	const tier = getRarityTier(item.rarityScore);

	return (
		<div className="group bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 transition-all hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5">
			{/* Cover Art */}
			<div className="relative aspect-square bg-surface-container-high">
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

				{/* Owner edit overlay */}
				{isOwner && onConditionEdit && (
					<button
						type="button"
						onClick={() => onConditionEdit(item.id)}
						className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-dim/80 p-1.5 rounded"
						aria-label="Edit condition grade"
					>
						<span className="material-symbols-outlined text-sm text-on-surface">
							edit
						</span>
					</button>
				)}

				{/* Rarity badge */}
				{tier && (
					<div className="absolute bottom-2 left-2">
						<Badge variant={getRarityBadgeVariant(tier)} className="text-[10px]">
							{tier}
						</Badge>
					</div>
				)}
			</div>

			{/* Info */}
			<div className="p-3">
				<h3 className="font-heading text-sm font-bold text-on-surface truncate">
					{item.title}
				</h3>
				<p className="text-xs text-on-surface-variant truncate">{item.artist}</p>
			</div>
		</div>
	);
}
