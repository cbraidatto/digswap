"use client";

import Link from "next/link";
import type { FeedItem } from "@/actions/social";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CoverArt } from "@/components/ui/cover-art";
import { DigButton } from "@/components/engagement/dig-button";
import { PlayButton } from "@/components/player/play-button";
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

export function FeedCard({ item, digState }: { item: FeedItem; digState?: { dug: boolean; digCount: number } }) {
	const tier = getRarityTier(item.releaseRarityScore);
	const accentColor = getAccentStripColor(tier);
	const rarityTextColor = getRarityTextColor(tier);

	return (
		<article className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10 transition-all hover:border-outline-variant/20 hover:shadow-md hover:shadow-black/5">
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

				<span className="text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 ml-auto">
					New find
				</span>
			</div>

			{/* Content grid */}
			<div className="px-4 pb-4 flex gap-4">
				{/* Cover art */}
				<CoverArt
					src={item.releaseCoverUrl}
					alt={`${item.releaseArtist} - ${item.releaseTitle}`}
					size="xl"
				/>

				{/* Metadata */}
				<div className="flex flex-col gap-1 min-w-0">
					<h3 className="font-heading text-sm font-bold text-on-surface truncate">
						{item.releaseTitle ?? "Unknown"}
					</h3>
					<p className="text-xs text-on-surface-variant truncate">
						{item.releaseArtist ?? "Unknown"}
					</p>
					<p className="text-xs text-on-surface-variant/70 truncate">
						{item.releaseGenre?.[0] ?? "Unknown"} · {item.releaseLabel ?? "Unknown"}
					</p>

					{/* Rarity badge */}
					<div className={`text-xs font-semibold mt-1.5 ${rarityTextColor}`}>
						{tier} · {item.releaseRarityScore !== null
							? item.releaseRarityScore.toFixed(1)
							: "--"}
					</div>

					{/* Dig button */}
					<div className="mt-2 flex items-center gap-2">
						<DigButton
							feedItemId={item.id}
							initialDug={digState?.dug ?? false}
							initialCount={digState?.digCount ?? 0}
							track={item.releaseYoutubeVideoId ? {
								videoId: item.releaseYoutubeVideoId,
								title: item.releaseTitle ?? "Unknown",
								artist: item.releaseArtist ?? "Unknown",
								coverUrl: item.releaseCoverUrl ?? null,
							} : undefined}
						/>
						<PlayButton
							videoId={item.releaseYoutubeVideoId}
							title={item.releaseTitle ?? "Unknown"}
							artist={item.releaseArtist ?? "Unknown"}
							coverUrl={item.releaseCoverUrl}
							size="sm"
						/>
					</div>
				</div>
			</div>
		</article>
	);
}
