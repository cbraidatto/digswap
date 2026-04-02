"use client";

import Link from "next/link";
import type { FeedItem } from "@/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRarityTier, type RarityTier } from "@/lib/collection/rarity";

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function getAccentStripColor(tier: RarityTier): string {
	switch (tier) {
		case "Common":
			return "bg-primary";
		case "Rare":
			return "bg-secondary";
		case "Ultra Rare":
			return "bg-tertiary";
		default:
			return "bg-outline-variant";
	}
}

function getRarityTextColor(tier: RarityTier): string {
	switch (tier) {
		case "Common":
			return "text-primary";
		case "Rare":
			return "text-secondary";
		case "Ultra Rare":
			return "text-tertiary";
		default:
			return "text-on-surface-variant";
	}
}

export function FeedCard({ item }: { item: FeedItem }) {
	const tier = getRarityTier(item.releaseRarityScore);
	const accentColor = getAccentStripColor(tier);
	const rarityTextColor = getRarityTextColor(tier);

	return (
		<article className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10">
			{/* Accent strip */}
			<div className={`h-1 w-full ${accentColor}`} />

			{/* Header row */}
			<div className="px-4 pt-3 pb-2 flex items-center gap-2">
				<Avatar size="default">
					{item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.username ?? ""} />}
					<AvatarFallback className="font-mono text-xs">
						{(item.username ?? "?")[0].toUpperCase()}
					</AvatarFallback>
				</Avatar>

				<Link
					href={`/perfil/${item.username}`}
					className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
				>
					{item.username}
				</Link>

				<span className="font-mono text-xs text-outline">
					#{item.id.slice(0, 4)}
				</span>

				<span className="font-mono text-xs text-on-surface-variant">
					{formatRelativeTime(item.createdAt)}
				</span>

				<span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 ml-auto">
					[NEW_FIND]
				</span>
			</div>

			{/* Content grid */}
			<div className="px-4 pb-4 flex gap-4">
				{/* Cover art */}
				<div className="w-[120px] h-[120px] max-sm:w-[80px] max-sm:h-[80px] bg-surface-container-high rounded flex items-center justify-center flex-shrink-0">
					{item.releaseCoverUrl ? (
						<img
							src={item.releaseCoverUrl}
							alt={`${item.releaseArtist} - ${item.releaseTitle}`}
							className="w-full h-full object-cover rounded"
						/>
					) : (
						<span className="material-symbols-outlined text-3xl text-on-surface-variant/30">
							album
						</span>
					)}
				</div>

				{/* Metadata */}
				<div className="flex flex-col gap-1 min-w-0">
					<div className="font-mono text-xs">
						<span className="text-on-surface-variant">ARTIST:</span>{" "}
						<span className="text-on-surface">{item.releaseArtist ?? "Unknown"}</span>
					</div>
					<div className="font-mono text-xs">
						<span className="text-on-surface-variant">TITLE:</span>{" "}
						<span className="text-on-surface">{item.releaseTitle ?? "Unknown"}</span>
					</div>
					<div className="font-mono text-xs">
						<span className="text-on-surface-variant">GENRE:</span>{" "}
						<span className="text-on-surface">
							{item.releaseGenre?.[0] ?? "Unknown"}
						</span>
					</div>
					<div className="font-mono text-xs">
						<span className="text-on-surface-variant">LABEL:</span>{" "}
						<span className="text-on-surface">{item.releaseLabel ?? "Unknown"}</span>
					</div>

					{/* Rarity badge */}
					<div className={`font-mono text-xs font-bold mt-2 ${rarityTextColor}`}>
						RARITY:{" "}
						{item.releaseRarityScore !== null
							? item.releaseRarityScore.toFixed(1)
							: "--"}
					</div>
				</div>
			</div>
		</article>
	);
}
