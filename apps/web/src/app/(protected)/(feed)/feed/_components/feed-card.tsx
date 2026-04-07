"use client";

import Image from "next/image";
import Link from "next/link";
import { DigButton } from "@/components/engagement/dig-button";
import { ContextLabel, type ContextReason } from "@/components/feed/context-label";
import { PlayButton } from "@/components/player/play-button";
import { getRarityTier, type RarityTier } from "@/lib/collection/rarity";
import type { FeedItem } from "@/lib/social/types";

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d`;
	return `${Math.floor(days / 7)}w`;
}

function getRarityStyle(tier: RarityTier) {
	switch (tier) {
		case "Ultra Rare":
			return {
				bg: "bg-tertiary/10",
				text: "text-tertiary",
				border: "border-tertiary/20",
				strip: "bg-tertiary",
			};
		case "Rare":
			return {
				bg: "bg-secondary/10",
				text: "text-secondary",
				border: "border-secondary/20",
				strip: "bg-secondary",
			};
		default:
			return {
				bg: "bg-primary/10",
				text: "text-primary",
				border: "border-primary/20",
				strip: "bg-primary",
			};
	}
}

function getActionLabel(actionType: string): { label: string; icon: string } {
	switch (actionType) {
		case "spinning_now":
			return { label: "is spinning", icon: "play_circle" };
		case "wrote_review":
			return { label: "reviewed", icon: "rate_review" };
		case "completed_trade":
			return { label: "traded", icon: "swap_horiz" };
		default:
			return { label: "added", icon: "add_circle" };
	}
}

export function FeedCard({
	item,
	digState,
	contextReason,
}: {
	item: FeedItem;
	digState?: { dug: boolean; digCount: number };
	contextReason?: ContextReason;
}) {
	const tier = getRarityTier(item.releaseRarityScore);
	const rarity = getRarityStyle(tier);
	const action = getActionLabel(item.actionType);
	const discogsId = item.metadata?.discogsId as number | undefined;

	return (
		<article className="bg-surface-container-low rounded-xl overflow-hidden border border-outline-variant/5 transition-all hover:border-outline-variant/15 hover:shadow-lg hover:shadow-black/5 group">
			{/* Rarity accent strip */}
			<div className={`h-0.5 w-full ${rarity.strip}`} />

			<div className="p-4">
				{/* User row */}
				<div className="flex items-center gap-2.5 mb-3">
					<Link href={`/perfil/${item.username}`} className="flex-shrink-0">
						{item.avatarUrl ? (
							<Image
								src={item.avatarUrl}
								alt=""
								width={36}
								height={36}
								unoptimized
								className="w-9 h-9 rounded-full object-cover border border-outline-variant/10"
							/>
						) : (
							<div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center border border-outline-variant/10">
								<span className="font-mono text-xs font-bold text-primary">
									{(item.username?.[0] ?? "?").toUpperCase()}
								</span>
							</div>
						)}
					</Link>
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5">
							<Link
								href={`/perfil/${item.username}`}
								className="font-mono text-xs font-semibold text-on-surface hover:text-primary transition-colors truncate"
							>
								{item.username ?? "digger"}
							</Link>
							<span className="font-mono text-[10px] text-on-surface-variant/50">
								{action.label}
							</span>
						</div>
						<span className="font-mono text-[10px] text-on-surface-variant/40">
							{formatRelativeTime(item.createdAt)}
						</span>
					</div>
					{/* Action icon */}
					<span className={`material-symbols-outlined text-[16px] ${rarity.text}`}>
						{action.icon}
					</span>
				</div>

				{/* Record content */}
				<div className="flex gap-3.5">
					{/* Cover art */}
					<Link
						href={discogsId ? `/release/${discogsId}` : "#"}
						className="flex-shrink-0 relative group/cover"
					>
						{item.releaseCoverUrl ? (
							<Image
								src={item.releaseCoverUrl}
								alt={`${item.releaseTitle} cover`}
								width={88}
								height={88}
								unoptimized
								className="w-[88px] h-[88px] rounded-lg object-cover shadow-md shadow-black/10"
							/>
						) : (
							<div className="w-[88px] h-[88px] rounded-lg bg-surface-container-high flex items-center justify-center shadow-md shadow-black/10">
								<span className="material-symbols-outlined text-3xl text-on-surface-variant/20">
									album
								</span>
							</div>
						)}
						{/* Play overlay on hover */}
						{item.releaseYoutubeVideoId && (
							<div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center">
								<PlayButton
									videoId={item.releaseYoutubeVideoId}
									title={item.releaseTitle ?? "Unknown"}
									artist={item.releaseArtist ?? "Unknown"}
									coverUrl={item.releaseCoverUrl}
									size="md"
								/>
							</div>
						)}
					</Link>

					{/* Info */}
					<div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
						<div>
							<Link
								href={discogsId ? `/release/${discogsId}` : "#"}
								className="font-heading text-sm font-bold text-on-surface hover:text-primary transition-colors line-clamp-1 block"
							>
								{item.releaseTitle ?? "Unknown"}
							</Link>
							<p className="font-mono text-xs text-on-surface-variant truncate mt-0.5">
								{item.releaseArtist ?? "Unknown"}
							</p>
							<div className="flex items-center gap-2 mt-1.5 flex-wrap">
								{item.releaseGenre?.[0] && (
									<span className="font-mono text-[10px] text-on-surface-variant/60 bg-surface-container-high/60 px-1.5 py-0.5 rounded">
										{item.releaseGenre[0]}
									</span>
								)}
								{item.releaseLabel && (
									<span className="font-mono text-[10px] text-on-surface-variant/40 truncate max-w-[120px]">
										{item.releaseLabel}
									</span>
								)}
							</div>
						</div>

						{/* Bottom row: rarity + actions */}
						<div className="flex items-center justify-between mt-2">
							<span
								className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border ${rarity.bg} ${rarity.text} ${rarity.border}`}
							>
								{tier}
								{item.releaseRarityScore != null ? ` · ${item.releaseRarityScore.toFixed(1)}` : ""}
							</span>

							<div className="flex items-center gap-1">
								<DigButton
									feedItemId={item.id}
									initialDug={digState?.dug ?? false}
									initialCount={digState?.digCount ?? 0}
									track={
										item.releaseYoutubeVideoId
											? {
													videoId: item.releaseYoutubeVideoId,
													title: item.releaseTitle ?? "Unknown",
													artist: item.releaseArtist ?? "Unknown",
													coverUrl: item.releaseCoverUrl ?? null,
												}
											: undefined
									}
								/>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Context label */}
			<ContextLabel reason={contextReason ?? null} />
		</article>
	);
}
