"use client";

import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ReactNode } from "react";
import type { CollectionItem } from "@/lib/collection/queries";
import { getRarityTier, getRarityBadgeVariant } from "@/lib/collection/rarity";
import { ConditionEditor } from "./condition-editor";

interface CollectionCardProps {
	item: CollectionItem;
	isOwner: boolean;
	actionSlot?: ReactNode;
}

export function CollectionCard({ item, isOwner, actionSlot }: CollectionCardProps) {
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
				<p className="text-xs text-on-surface-variant truncate mb-2">{item.artist}</p>
				{/* Condition editor — only visible to owner */}
				{isOwner && (
					<ConditionEditor
						collectionItemId={item.id}
						currentGrade={item.conditionGrade ?? null}
					/>
				)}
				{actionSlot}
			</div>
		</div>
	);
}
