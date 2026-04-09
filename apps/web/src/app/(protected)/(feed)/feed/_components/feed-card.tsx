"use client";

import Image from "next/image";
import Link from "next/link";
import { DigButton } from "@/components/engagement/dig-button";
import { ContextLabel, type ContextReason } from "@/components/feed/context-label";
import { PlayButton } from "@/components/player/play-button";
import { GemBadge } from "@/components/ui/gem-badge";
import { WaveformDecoration } from "@/components/ui/waveform-decoration";
import { getGemTier } from "@/lib/gems/constants";
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

function getActionConfig(actionType: string): {
	label: string;
	icon: string;
	color: string;
	bg: string;
} {
	switch (actionType) {
		case "spinning_now":
			return {
				label: "Spinning",
				icon: "play_circle",
				color: "text-emerald-400",
				bg: "bg-emerald-400/10 border-emerald-400/20",
			};
		case "wrote_review":
			return {
				label: "Reviewed",
				icon: "rate_review",
				color: "text-amber-400",
				bg: "bg-amber-400/10 border-amber-400/20",
			};
		case "completed_trade":
			return {
				label: "Traded",
				icon: "swap_horiz",
				color: "text-blue-400",
				bg: "bg-blue-400/10 border-blue-400/20",
			};
		default:
			return {
				label: "Added",
				icon: "add_circle",
				color: "text-primary",
				bg: "bg-primary/10 border-primary/20",
			};
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
	const tier = getGemTier(item.releaseRarityScore);
	const action = getActionConfig(item.actionType);
	const discogsId = item.metadata?.discogsId as number | undefined;
	const hasRecord = item.releaseTitle && item.releaseTitle !== "Unknown";

	return (
		<article className="rounded-2xl overflow-hidden border border-outline-variant/8 transition-all hover:border-outline-variant/20 hover:shadow-2xl hover:shadow-black/15 hover:-translate-y-0.5 group relative">
			{/* ── Background: blurred cover art creates atmosphere ── */}
			{item.releaseCoverUrl && (
				<div className="absolute inset-0 overflow-hidden">
					<Image
						src={item.releaseCoverUrl}
						alt=""
						fill
						unoptimized
						className="object-cover scale-110 blur-3xl opacity-[0.07] group-hover:opacity-[0.12] transition-opacity"
					/>
				</div>
			)}

			{/* Card surface */}
			<div className="relative bg-surface-container-low/90 backdrop-blur-sm">
				{/* ── Header: compact user row ── */}
				<div className="flex items-center gap-3 px-5 pt-4 pb-3">
					<Link href={`/perfil/${item.username}`} className="flex-shrink-0">
						{item.avatarUrl ? (
							<Image
								src={item.avatarUrl}
								alt=""
								width={36}
								height={36}
								unoptimized
								className="w-9 h-9 rounded-full object-cover ring-2 ring-white/5 group-hover:ring-primary/30 transition-all"
							/>
						) : (
							<div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center ring-2 ring-white/5">
								<span className="font-mono text-xs font-bold text-primary">
									{(item.username?.[0] ?? "?").toUpperCase()}
								</span>
							</div>
						)}
					</Link>

					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<Link
								href={`/perfil/${item.username}`}
								className="font-mono text-[13px] font-bold text-on-surface hover:text-primary transition-colors truncate"
							>
								{item.username ?? "digger"}
							</Link>
							<span className="font-mono text-[11px] text-on-surface-variant/35">
								{formatRelativeTime(item.createdAt)}
							</span>
						</div>
					</div>

					{/* Action badge */}
					<span
						className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wide border ${action.bg} ${action.color}`}
					>
						<span
							className="material-symbols-outlined text-[13px]"
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							{action.icon}
						</span>
						{action.label}
					</span>
				</div>

				{/* ── Record content ── */}
				{hasRecord ? (
					<div className="px-5 pb-4">
						{/* Main content row */}
						<div className="flex gap-4">
							{/* Cover art — hero element */}
							<Link
								href={discogsId ? `/release/${discogsId}` : "#"}
								className="flex-shrink-0 relative group/cover"
							>
								<div className="relative">
									{item.releaseCoverUrl ? (
										<Image
											src={item.releaseCoverUrl}
											alt={`${item.releaseTitle} cover`}
											width={130}
											height={130}
											unoptimized
											className="w-[130px] h-[130px] rounded-xl object-cover shadow-2xl shadow-black/30 group-hover/cover:scale-[1.03] transition-transform"
										/>
									) : (
										<div className="w-[130px] h-[130px] rounded-xl bg-gradient-to-br from-surface-container-high via-surface-container-high/80 to-surface-container flex flex-col items-center justify-center shadow-2xl shadow-black/30 gap-1.5">
											<span
												className="material-symbols-outlined text-4xl text-on-surface-variant/15"
												style={{ fontVariationSettings: "'FILL' 1" }}
											>
												album
											</span>
											<span className="font-mono text-[8px] text-on-surface-variant/15 uppercase tracking-widest">
												No cover
											</span>
										</div>
									)}

									{/* Gem badge over cover */}
									{tier && (
										<div className="absolute -bottom-1.5 -left-1.5 z-10">
											<GemBadge score={item.releaseRarityScore} />
										</div>
									)}

									{/* Play overlay */}
									{item.releaseYoutubeVideoId && (
										<div className="absolute inset-0 bg-black/50 rounded-xl opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
											<PlayButton
												videoId={item.releaseYoutubeVideoId}
												title={item.releaseTitle ?? "Unknown"}
												artist={item.releaseArtist ?? "Unknown"}
												coverUrl={item.releaseCoverUrl}
												size="md"
											/>
										</div>
									)}
								</div>
							</Link>

							{/* Info column */}
							<div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
								<div>
									<Link
										href={discogsId ? `/release/${discogsId}` : "#"}
										className="font-heading text-lg font-bold text-on-surface hover:text-primary transition-colors line-clamp-2 block leading-tight"
									>
										{item.releaseTitle}
									</Link>
									<p className="font-mono text-sm text-on-surface-variant/50 truncate mt-1.5">
										{item.releaseArtist ?? "Unknown artist"}
									</p>

									{/* Tags row */}
									<div className="flex items-center gap-2 mt-3 flex-wrap">
										{item.releaseGenre?.[0] && (
											<span className="font-mono text-[10px] font-bold text-on-surface-variant/70 bg-surface-container-high/80 px-2.5 py-1 rounded-md border border-outline-variant/10 uppercase tracking-wide">
												{item.releaseGenre[0]}
											</span>
										)}
										{item.releaseLabel && (
											<span className="font-mono text-[10px] text-on-surface-variant/30 truncate max-w-[140px]">
												{item.releaseLabel}
											</span>
										)}
									</div>
								</div>

								{/* Waveform + Dig */}
								<div className="flex items-end justify-between gap-3 mt-3">
									<div className="flex-1 min-w-0 text-primary/30">
										<WaveformDecoration
											releaseId={item.id}
											barCount={32}
											className="opacity-25 group-hover:opacity-50 transition-opacity"
										/>
									</div>
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
				) : (
					/* ── Fallback for unknown records ── */
					<div className="px-5 pb-4">
						<div className="flex items-center gap-4 bg-surface-container-high/20 rounded-xl p-4 border border-outline-variant/5">
							<div className="w-12 h-12 rounded-lg bg-surface-container-high/50 flex items-center justify-center flex-shrink-0">
								<span
									className="material-symbols-outlined text-xl text-on-surface-variant/20"
									style={{ fontVariationSettings: "'FILL' 1" }}
								>
									{action.icon}
								</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="font-mono text-sm text-on-surface-variant/40">
									Record details unavailable
								</p>
								<p className="font-mono text-[10px] text-on-surface-variant/25 mt-0.5">
									This record may not be in the database yet
								</p>
							</div>
							<DigButton
								feedItemId={item.id}
								initialDug={digState?.dug ?? false}
								initialCount={digState?.digCount ?? 0}
							/>
						</div>
					</div>
				)}
			</div>

			{/* Context label */}
			<ContextLabel reason={contextReason ?? null} />
		</article>
	);
}
