import { cn } from "@/lib/utils";

interface CollectionValueProps {
	totalRecords: number;
	avgRarity: number;
	ultraRareCount: number;
	rareCount: number;
	commonCount: number;
}

export function CollectionValueTracker({
	totalRecords,
	avgRarity,
	ultraRareCount,
	rareCount,
	commonCount,
}: CollectionValueProps) {
	const total = ultraRareCount + rareCount + commonCount;
	const ultraPct = total > 0 ? Math.round((ultraRareCount / total) * 100) : 0;
	const rarePct = total > 0 ? Math.round((rareCount / total) * 100) : 0;
	const commonPct = total > 0 ? 100 - ultraPct - rarePct : 0;

	return (
		<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-5">
			<div className="flex items-center gap-2 mb-4">
				<span className="material-symbols-outlined text-xl text-primary">insights</span>
				<h3 className="font-heading text-base font-semibold text-on-surface">
					Collection overview
				</h3>
			</div>

			{/* Big number */}
			<div className="text-center mb-5">
				<div className="font-heading text-4xl font-extrabold text-on-surface">{totalRecords}</div>
				<div className="text-xs text-on-surface-variant">Total records</div>
			</div>

			{/* Rarity distribution bar */}
			{total > 0 && (
				<div className="mb-4">
					<div className="flex h-3 rounded-full overflow-hidden gap-0.5">
						{ultraPct > 0 && (
							<div
								className="bg-tertiary rounded-full"
								style={{ width: `${ultraPct}%` }}
								title={`Ultra Rare: ${ultraPct}%`}
							/>
						)}
						{rarePct > 0 && (
							<div
								className="bg-secondary rounded-full"
								style={{ width: `${rarePct}%` }}
								title={`Rare: ${rarePct}%`}
							/>
						)}
						{commonPct > 0 && (
							<div
								className="bg-primary/40 rounded-full"
								style={{ width: `${commonPct}%` }}
								title={`Common: ${commonPct}%`}
							/>
						)}
					</div>
					<div className="flex justify-between mt-2 text-xs">
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-full bg-tertiary" />
							<span className="text-on-surface-variant">Ultra Rare ({ultraRareCount})</span>
						</span>
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-full bg-secondary" />
							<span className="text-on-surface-variant">Rare ({rareCount})</span>
						</span>
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-full bg-primary/40" />
							<span className="text-on-surface-variant">Common ({commonCount})</span>
						</span>
					</div>
				</div>
			)}

			{/* Avg rarity */}
			<div className="flex items-center justify-between p-3 rounded-lg bg-surface-container/50">
				<span className="text-xs text-on-surface-variant">Average rarity score</span>
				<span
					className={cn(
						"font-heading text-base font-bold",
						avgRarity >= 75 ? "text-tertiary" : avgRarity >= 50 ? "text-secondary" : "text-primary",
					)}
				>
					{avgRarity.toFixed(1)}
				</span>
			</div>
		</div>
	);
}
