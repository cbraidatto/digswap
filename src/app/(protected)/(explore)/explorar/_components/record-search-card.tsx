"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { SearchResult } from "@/lib/discovery/queries";
import { getRarityTier } from "@/lib/collection/rarity";
import { getReviewCountAction } from "@/actions/community";
import { AddToCrateButton } from "@/components/crates/add-to-crate-button";
import { OwnersList } from "./owners-list";
import { ReviewsPanel } from "./reviews-panel";

function getRarityColors(tier: string | null): string {
	switch (tier) {
		case "Ultra Rare":
			return "text-tertiary border-tertiary";
		case "Rare":
			return "text-secondary border-secondary";
		case "Common":
			return "text-on-surface-variant border-outline-variant";
		default:
			return "";
	}
}

interface RecordSearchCardProps {
	release: SearchResult;
}

export function RecordSearchCard({ release }: RecordSearchCardProps) {
	const rarityTier = getRarityTier(release.rarityScore);
	const [isReviewsExpanded, setIsReviewsExpanded] = useState(false);
	const [reviewCount, setReviewCount] = useState<number | null>(null);

	useEffect(() => {
		getReviewCountAction(release.id).then((count) => setReviewCount(count));
	}, [release.id]);

	return (
		<div>
			<div className="bg-surface-container-low rounded-lg p-4 flex gap-4 hover:bg-surface-container transition-colors cursor-pointer group">
				{/* Album Art */}
				<div className="w-12 h-12 bg-surface-container-high rounded flex-shrink-0 flex items-center justify-center">
					{release.coverImageUrl ? (
						<img
							src={release.coverImageUrl}
							alt={release.title}
							className="w-full h-full object-cover rounded"
						/>
					) : (
						<span className="material-symbols-outlined text-on-surface-variant/40 text-xl">
							album
						</span>
					)}
				</div>

				{/* Info */}
				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2 mb-1">
						<span className="font-heading font-semibold text-on-surface group-hover:text-primary transition-colors truncate text-sm">
							{release.title}
						</span>
						{rarityTier && (
							<span
								className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${getRarityColors(rarityTier)}`}
							>
								[{rarityTier.toUpperCase()}]
							</span>
						)}
					</div>
					<div className="flex flex-wrap items-center gap-3 text-[10px] text-on-surface-variant font-mono">
						<span>{release.artist}</span>
						{release.label && (
							<>
								<span>.</span>
								<span>{release.label}</span>
							</>
						)}
						{release.year && (
							<>
								<span>.</span>
								<span>{release.year}</span>
							</>
						)}
						{release.format && (
							<>
								<span>.</span>
								<span>{release.format}</span>
							</>
						)}
					</div>
					{release.discogsId && (
						<Link
							href={`/release/${release.discogsId}`}
							className="font-mono text-[10px] text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-0.5 mt-1"
						>
							VIEW_RELEASE
							<span className="material-symbols-outlined text-[12px]">arrow_forward</span>
						</Link>
					)}
					<div className="mt-1">
						<AddToCrateButton
							releaseId={release.id}
							discogsId={release.discogsId}
							title={release.title}
							artist={release.artist}
							coverImageUrl={release.coverImageUrl ?? null}
						/>
					</div>
				</div>

				{/* Owner Count */}
				<div className="flex flex-col items-end gap-1 flex-shrink-0">
					<span className="text-[10px] font-mono text-on-surface-variant">
						{release.ownerCount}{" "}
						{release.ownerCount === 1 ? "owner" : "owners"}
					</span>
				</div>
			</div>

			{/* Owners List */}
			<OwnersList owners={release.owners} />

			{/* Review trigger */}
			{reviewCount !== null && (
				<div className="pl-16 py-1">
					<button
						type="button"
						onClick={() => setIsReviewsExpanded((prev) => !prev)}
						className="font-mono text-[10px] text-primary hover:underline cursor-pointer"
						aria-expanded={isReviewsExpanded}
						aria-controls={`reviews-panel-${release.id}`}
					>
						{reviewCount === 1 ? "review: 1" : `reviews: ${reviewCount}`}
						{isReviewsExpanded ? " \u2191 collapse" : " \u2193"}
					</button>
				</div>
			)}

			{/* Reviews Panel */}
			<div id={`reviews-panel-${release.id}`}>
				<ReviewsPanel
					releaseId={release.id}
					isExpanded={isReviewsExpanded}
				/>
			</div>
		</div>
	);
}
