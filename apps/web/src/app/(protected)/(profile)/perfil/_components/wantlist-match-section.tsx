"use client";

import { useState } from "react";
import { CoverArt } from "@/components/ui/cover-art";
import { RarityPill } from "@/components/ui/rarity-pill";
import { RecordLink } from "@/components/ui/record-link";
import type { WantlistIntersection } from "@/lib/wantlist/intersection-queries";

function _getRarityLabel(score: number | null): {
	label: string;
	colorClass: string;
} {
	if (!score) return { label: "COMMON", colorClass: "text-on-surface-variant" };
	if (score >= 80) return { label: "ULTRA_RARE", colorClass: "text-tertiary" };
	if (score >= 50) return { label: "RARE", colorClass: "text-secondary" };
	return { label: "COMMON", colorClass: "text-primary" };
}

interface WantlistMatchSectionProps {
	intersections: WantlistIntersection[];
	onFilterChange: (filterIds: string[] | null) => void;
}

export function WantlistMatchSection({ intersections, onFilterChange }: WantlistMatchSectionProps) {
	const [filterActive, setFilterActive] = useState(false);

	if (intersections.length === 0) return null;

	const handleToggleFilter = () => {
		const next = !filterActive;
		setFilterActive(next);
		onFilterChange(next ? intersections.map((i) => i.releaseId) : null);
	};

	return (
		<div className="mb-6 bg-surface-container-low border border-outline-variant/20 rounded overflow-hidden">
			<div className="h-0.5 bg-primary" />
			<div className="p-4">
				{/* Header */}
				<div className="flex items-center justify-between mb-3">
					<div>
						<div className="font-mono text-xs text-primary tracking-[0.2em]">RADAR_MATCH</div>
						<p className="font-mono text-[12px] text-on-surface mt-0.5">
							{intersections.length} record
							{intersections.length !== 1 ? "s" : ""} in this crate match your wantlist
						</p>
					</div>
					<button
						type="button"
						onClick={handleToggleFilter}
						className={`font-mono text-xs px-3 py-1.5 rounded border transition-colors ${
							filterActive
								? "border-primary text-primary bg-primary/10"
								: "border-outline-variant/30 text-on-surface-variant hover:border-primary hover:text-primary"
						}`}
					>
						{filterActive ? "[VIEW_FULL_CRATE]" : "[SHOW_ONLY_MATCHES]"}
					</button>
				</div>

				{/* Horizontal scroll of match cards — max 6 visible */}
				<div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
					{intersections.slice(0, 6).map((item) => (
						<RecordLink
							key={item.releaseId}
							discogsId={item.discogsId}
							className="flex-shrink-0 w-24 space-y-1 group"
						>
							<CoverArt
								src={item.coverArt}
								alt={item.releaseTitle}
								size="full"
								fill
								containerClassName="w-24 h-24"
								rounded="rounded"
							/>
							<div className="font-mono text-[9px] text-on-surface group-hover:text-primary transition-colors leading-tight truncate">
								{item.releaseTitle}
							</div>
							<RarityPill score={item.rarityScore} showScore={false} className="text-[8px]" />
						</RecordLink>
					))}
					{intersections.length > 6 && (
						<div className="flex-shrink-0 w-24 h-24 rounded bg-surface-container-high flex items-center justify-center">
							<span className="font-mono text-xs text-on-surface-variant">
								+{intersections.length - 6} more
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
