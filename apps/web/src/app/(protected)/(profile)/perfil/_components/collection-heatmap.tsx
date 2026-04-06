"use client";

interface HeatmapProps {
	/** Map of ISO date string (YYYY-MM-DD) → count of records added */
	data: Record<string, number>;
}

const DAYS = 7;
const WEEKS = 20;

function getDateKey(date: Date): string {
	return date.toISOString().split("T")[0];
}

function getColor(count: number): string {
	if (count === 0) return "bg-surface-container-high/30";
	if (count === 1) return "bg-primary/20";
	if (count <= 3) return "bg-primary/40";
	if (count <= 5) return "bg-primary/60";
	return "bg-primary/90";
}

export function CollectionHeatmap({ data }: HeatmapProps) {
	const today = new Date();
	const cells: { date: string; count: number }[] = [];

	for (let w = WEEKS - 1; w >= 0; w--) {
		for (let d = 0; d < DAYS; d++) {
			const date = new Date(today);
			date.setDate(today.getDate() - (w * 7 + (6 - d)));
			const key = getDateKey(date);
			cells.push({ date: key, count: data[key] ?? 0 });
		}
	}

	return (
		<div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5">
			<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
				<span className="material-symbols-outlined text-[14px] text-primary">calendar_month</span>
				Digging Activity
			</h3>
			<div className="flex gap-[3px]">
				{Array.from({ length: WEEKS }).map((_, w) => (
					<div key={w} className="flex flex-col gap-[3px]">
						{Array.from({ length: DAYS }).map((_, d) => {
							const cell = cells[w * DAYS + d];
							return (
								<div
									key={cell.date}
									className={`w-2.5 h-2.5 rounded-sm ${getColor(cell.count)} transition-colors`}
									title={`${cell.date}: ${cell.count} record${cell.count !== 1 ? "s" : ""} added`}
								/>
							);
						})}
					</div>
				))}
			</div>
			{/* Legend */}
			<div className="flex items-center gap-2 mt-2">
				<span className="font-mono text-[8px] text-on-surface-variant/40">Less</span>
				{[0, 1, 3, 5, 6].map((n) => (
					<div key={n} className={`w-2 h-2 rounded-sm ${getColor(n)}`} />
				))}
				<span className="font-mono text-[8px] text-on-surface-variant/40">More</span>
			</div>
		</div>
	);
}
