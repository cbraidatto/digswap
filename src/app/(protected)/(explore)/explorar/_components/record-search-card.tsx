"use client";

import type { SearchResult } from "@/lib/discovery/queries";
import { getRarityTier } from "@/lib/collection/rarity";
import { OwnersList } from "./owners-list";

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
		</div>
	);
}
