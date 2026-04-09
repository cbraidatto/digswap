"use client";

import Link from "next/link";
import { GemBadge } from "@/components/ui/gem-badge";
import { StarRating } from "@/components/ui/star-rating";
import type { FeedItem } from "@/lib/social/types";

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

export function GroupFeedCard({ item }: { item: FeedItem }) {
	const groupName = (item.metadata?.groupName as string) ?? "a group";
	const groupSlug = (item.metadata?.groupSlug as string) ?? "";
	const rating = typeof item.metadata?.rating === "number" ? item.metadata.rating : null;
	const content = (item.metadata?.content as string) ?? "";
	const linkedTitle = item.releaseTitle ?? (item.metadata?.releaseTitle as string) ?? null;

	const isReview = item.actionType === "wrote_review";

	return (
		<article className="bg-surface-container-low rounded-2xl overflow-hidden border border-outline-variant/8 hover:border-outline-variant/20 hover:shadow-lg hover:shadow-black/5 transition-all">
			{/* Accent strip */}
			<div
				className={`h-1 w-full ${isReview ? "bg-gradient-to-r from-amber-500 to-amber-500/40" : "bg-gradient-to-r from-secondary to-secondary/40"}`}
			/>

			<div className="p-5">
				{/* Header row */}
				<div className="flex items-center gap-3 mb-3">
					<div
						className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isReview ? "bg-amber-500/10" : "bg-secondary/10"}`}
					>
						<span
							className={`material-symbols-outlined text-base ${isReview ? "text-amber-500" : "text-secondary"}`}
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							{isReview ? "rate_review" : "forum"}
						</span>
					</div>

					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-1.5">
							<Link
								href={`/perfil/${item.username}`}
								className="font-mono text-sm font-semibold text-on-surface hover:text-primary transition-colors"
							>
								{item.username}
							</Link>
							<span className="font-mono text-[11px] text-on-surface-variant/40">
								{formatRelativeTime(item.createdAt)}
							</span>
						</div>
						<div className="font-mono text-xs text-on-surface-variant/60">
							{isReview ? "reviewed in " : "posted in "}
							{groupSlug ? (
								<Link
									href={`/comunidade/${groupSlug}`}
									className="text-on-surface-variant hover:text-primary transition-colors"
								>
									{groupName}
								</Link>
							) : (
								<span>{groupName}</span>
							)}
						</div>
					</div>
				</div>

				{/* Star rating for reviews */}
				{rating !== null && (
					<div className="mb-3">
						<StarRating rating={rating} />
					</div>
				)}

				{/* Post body */}
				{content && (
					<div className="mb-3">
						<p className="text-sm text-on-surface leading-relaxed line-clamp-3">{content}</p>
						{groupSlug && (
							<Link
								href={`/comunidade/${groupSlug}`}
								className="font-mono text-xs text-primary hover:text-primary/80 mt-1 inline-block"
							>
								Read more →
							</Link>
						)}
					</div>
				)}

				{/* Linked record reference */}
				{linkedTitle && (
					<div className="flex items-center gap-2.5 bg-surface-container-high/40 px-3.5 py-2.5 rounded-xl">
						<span className="material-symbols-outlined text-lg text-on-surface-variant/40">
							album
						</span>
						<div className="flex-1 min-w-0">
							<span className="font-mono text-xs text-on-surface font-medium truncate block">
								{linkedTitle}
							</span>
							{item.releaseArtist && (
								<span className="font-mono text-[10px] text-on-surface-variant/50">
									{item.releaseArtist}
								</span>
							)}
						</div>
						<GemBadge score={item.releaseRarityScore} />
					</div>
				)}
			</div>
		</article>
	);
}
