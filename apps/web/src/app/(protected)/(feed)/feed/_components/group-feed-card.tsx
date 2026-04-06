"use client";

import Link from "next/link";
import type { FeedItem } from "@/lib/social/types";
import { StarRating } from "@/components/ui/star-rating";
import { RarityPill } from "@/components/ui/rarity-pill";

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
	const groupName =
		(item.metadata?.groupName as string) ?? "a group";
	const groupSlug =
		(item.metadata?.groupSlug as string) ?? "";
	const rating =
		typeof item.metadata?.rating === "number" ? item.metadata.rating : null;
	const content =
		(item.metadata?.content as string) ?? "";
	const releaseId =
		(item.metadata?.releaseId as string) ?? null;
	const linkedTitle =
		item.releaseTitle ?? (item.metadata?.releaseTitle as string) ?? null;

	return (
		<article className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10">
			{/* Accent strip - neutral for group posts */}
			<div className="h-1 w-full bg-surface-container-high" />

			{/* Header row */}
			<div className="px-4 pt-3 pb-2">
				<div className="flex items-center gap-1.5">
					<span className="font-mono text-xs text-primary">
						&gt;
					</span>
					<Link
						href={`/perfil/${item.username}`}
						className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
					>
						{item.username}
					</Link>
					<span className="font-mono text-xs text-on-surface-variant">
						{" \u00B7 "}
						{formatRelativeTime(item.createdAt)}
					</span>
				</div>

				{/* Second header line: posted in group */}
				<div className="font-mono text-xs text-on-surface-variant mt-0.5">
					posted in{" "}
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

			{/* Star rating for reviews */}
			{rating !== null && (
				<div className="px-4 pb-1">
					<StarRating rating={rating} />
				</div>
			)}

			{/* Post body */}
			{content && (
				<div className="px-4 pb-2">
					<p className="text-sm text-on-surface leading-relaxed line-clamp-2">
						{content}
					</p>
					{groupSlug && (
						<Link
							href={`/comunidade/${groupSlug}`}
							className="font-mono text-xs text-primary hover:underline"
						>
							[more]
						</Link>
					)}
				</div>
			)}

			{/* Linked record reference */}
			{linkedTitle && (
				<div className="px-4 pb-3 flex items-center gap-2">
					<span className="font-mono text-xs text-on-surface-variant">{"\u2514"}</span>
					<span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">album</span>
					<span className="font-mono text-xs text-on-surface">
						{linkedTitle}
					</span>
					{item.releaseArtist && (
						<span className="font-mono text-[10px] text-on-surface-variant">
							· {item.releaseArtist}
						</span>
					)}
					<RarityPill score={item.releaseRarityScore} showScore={false} />
				</div>
			)}
		</article>
	);
}
