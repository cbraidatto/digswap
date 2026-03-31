"use client";

import { useState } from "react";
import type { WantlistIntersection } from "@/lib/wantlist/intersection-queries";

function getRarityLabel(score: number | null): {
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

export function WantlistMatchSection({
	intersections,
	onFilterChange,
}: WantlistMatchSectionProps) {
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
						<div className="font-mono text-[10px] text-primary tracking-[0.2em]">
							RADAR_MATCH
						</div>
						<p className="font-mono text-[12px] text-on-surface mt-0.5">
							{intersections.length} record
							{intersections.length !== 1 ? "s" : ""} in this crate match your
							wantlist
						</p>
					</div>
					<button
						type="button"
						onClick={handleToggleFilter}
						className={`font-mono text-[10px] px-3 py-1.5 rounded border transition-colors ${
							filterActive
								? "border-primary text-primary bg-primary/10"
								: "border-outline-variant/30 text-on-surface-variant hover:border-primary hover:text-primary"
						}`}
					>
						{filterActive ? "[VIEW_FULL_CRATE]" : "[SHOW_ONLY_MATCHES]"}
					</button>
				</div>

				{/* Horizontal scroll of match cards — max 6 visible */}
				<div
					className="flex gap-3 overflow-x-auto pb-2"
					style={{ scrollbarWidth: "thin" }}
				>
					{intersections.slice(0, 6).map((item) => {
						const rarity = getRarityLabel(item.rarityScore);
						return (
							<div key={item.releaseId} className="flex-shrink-0 w-24 space-y-1">
								<div className="w-24 h-24 rounded bg-surface-container-high overflow-hidden">
									{item.coverArt ? (
										<img
											src={item.coverArt}
											alt={item.releaseTitle}
											className="w-full h-full object-cover"
										/>
									) : (
										<div className="w-full h-full flex items-center justify-center">
											<span className="material-symbols-outlined text-on-surface-variant text-2xl">
												album
											</span>
										</div>
									)}
								</div>
								<div className="font-mono text-[9px] text-on-surface leading-tight truncate">
									{item.releaseTitle}
								</div>
								<div className={`font-mono text-[8px] ${rarity.colorClass}`}>
									[{rarity.label}]
								</div>
							</div>
						);
					})}
					{intersections.length > 6 && (
						<div className="flex-shrink-0 w-24 h-24 rounded bg-surface-container-high flex items-center justify-center">
							<span className="font-mono text-[10px] text-on-surface-variant">
								+{intersections.length - 6} more
							</span>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
