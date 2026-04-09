"use client";

import Image from "next/image";
import type { TradeableItem } from "@/lib/trades/proposal-queries";

interface ProposalItemCardProps {
	item: TradeableItem;
	isSelected: boolean;
	isDisabled: boolean;
	onSelect: () => void;
	side: "offer" | "want";
}

function formatAudioQuality(item: TradeableItem): string | null {
	if (!item.audioFormat) return null;
	const parts = [item.audioFormat.toUpperCase()];
	if (item.bitrate) parts.push(`${item.bitrate}kbps`);
	return parts.join(" \u00b7 ");
}

export function ProposalItemCard({
	item,
	isSelected,
	isDisabled,
	onSelect,
}: ProposalItemCardProps) {
	const audioLine = formatAudioQuality(item);

	return (
		<button
			type="button"
			onClick={onSelect}
			disabled={isDisabled && !isSelected}
			className={`w-full text-left bg-surface-container-lowest border rounded p-3 transition-colors ${
				isSelected
					? "border-primary ring-1 ring-primary/30"
					: "border-outline-variant hover:border-outline"
			} ${isDisabled && !isSelected ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
		>
			<div className="flex items-start gap-3">
				{/* Cover image */}
				<div className="relative w-11 h-11 flex-shrink-0 rounded overflow-hidden bg-surface-container-high">
					{item.coverImageUrl ? (
						<Image
							src={item.coverImageUrl}
							alt={`${item.title} by ${item.artist}`}
							fill
							sizes="44px"
							className="object-cover"
							unoptimized
						/>
					) : (
						<div className="absolute inset-0 flex items-center justify-center">
							<span className="material-symbols-outlined text-xl text-on-surface-variant/30">
								album
							</span>
						</div>
					)}
					{/* Selected overlay */}
					{isSelected && (
						<div className="absolute inset-0 bg-primary/30 flex items-center justify-center">
							<span className="material-symbols-outlined text-lg text-primary-foreground">
								check_circle
							</span>
						</div>
					)}
				</div>

				{/* Text info */}
				<div className="min-w-0 flex-1">
					<h4 className="text-sm font-heading font-bold text-on-surface truncate leading-snug">
						{item.title}
					</h4>
					<p className="text-xs text-muted-foreground truncate">
						{item.artist}
						{item.year ? ` \u00b7 ${item.year}` : ""}
					</p>

					{/* Condition + audio quality badges */}
					<div className="flex items-center gap-1.5 mt-1 flex-wrap">
						{item.conditionGrade && (
							<span className="font-mono text-[9px] font-bold bg-surface-container-high text-on-surface px-1.5 py-0.5 rounded">
								{item.conditionGrade}
							</span>
						)}
						{audioLine && (
							<span className="font-mono text-[9px] text-muted-foreground/70">
								{audioLine}
							</span>
						)}
					</div>
				</div>
			</div>
		</button>
	);
}
