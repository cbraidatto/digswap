import { cn } from "@/lib/utils";

interface DiggerDnaProps {
	topGenres: { name: string; percentage: number }[];
	topDecades: { decade: string; percentage: number }[];
	topCountries: { name: string; count: number }[];
	rarityProfile: string;
	avgRarity: number;
	totalRecords: number;
}

const profileLabels: Record<string, { label: string; color: string; icon: string }> = {
	diamond_chaser: { label: "Diamond Chaser", color: "text-tertiary", icon: "diamond" },
	ruby_hunter: { label: "Ruby Hunter", color: "text-secondary", icon: "psychology" },
	emerald_seeker: { label: "Emerald Seeker", color: "text-primary", icon: "balance" },
	quartz_collector: {
		label: "Quartz Collector",
		color: "text-on-surface-variant",
		icon: "trending_up",
	},
	newcomer: { label: "Newcomer", color: "text-on-surface-variant", icon: "waving_hand" },
	// Legacy labels (for cached DB values before gem migration)
	ultra_rare_hunter: { label: "Diamond Chaser", color: "text-tertiary", icon: "diamond" },
	deep_cutter: { label: "Ruby Hunter", color: "text-secondary", icon: "psychology" },
	balanced_digger: { label: "Emerald Seeker", color: "text-primary", icon: "balance" },
	mainstream_maven: {
		label: "Quartz Collector",
		color: "text-on-surface-variant",
		icon: "trending_up",
	},
};

function PercentageBar({
	label,
	percentage,
	color,
}: {
	label: string;
	percentage: number;
	color: string;
}) {
	return (
		<div className="flex items-center gap-2">
			<span className="text-xs text-on-surface-variant w-20 truncate">{label}</span>
			<div className="flex-1 h-2 rounded-full bg-surface-container-high overflow-hidden">
				<div
					className={cn("h-full rounded-full transition-all", color)}
					style={{ width: `${Math.min(percentage, 100)}%` }}
				/>
			</div>
			<span className="text-xs text-on-surface-variant w-8 text-right">{percentage}%</span>
		</div>
	);
}

export function DiggerDnaCard({
	topGenres,
	topDecades,
	topCountries,
	rarityProfile,
	avgRarity,
	totalRecords,
}: DiggerDnaProps) {
	const profile = profileLabels[rarityProfile] ?? profileLabels.newcomer;

	if (totalRecords === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6 text-center">
				<span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2 block">
					fingerprint
				</span>
				<p className="text-sm text-on-surface-variant">
					Add records to your collection to generate your Digger DNA.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
			{/* Header */}
			<div className="p-5 pb-4">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<span className="material-symbols-outlined text-xl text-primary">fingerprint</span>
						<h3 className="font-heading text-base font-semibold text-on-surface">Digger DNA</h3>
					</div>
					<div className={cn("flex items-center gap-1 text-xs font-medium", profile.color)}>
						<span className="material-symbols-outlined text-base">{profile.icon}</span>
						{profile.label}
					</div>
				</div>

				{/* Stats row */}
				<div className="grid grid-cols-3 gap-3 mb-5">
					<div className="text-center p-2 rounded-lg bg-surface-container/50">
						<div className="font-heading text-lg font-bold text-on-surface">{totalRecords}</div>
						<div className="text-xs text-on-surface-variant">Records</div>
					</div>
					<div className="text-center p-2 rounded-lg bg-surface-container/50">
						<div className="font-heading text-lg font-bold text-on-surface">
							{avgRarity.toFixed(1)}
						</div>
						<div className="text-xs text-on-surface-variant">Avg rarity</div>
					</div>
					<div className="text-center p-2 rounded-lg bg-surface-container/50">
						<div className="font-heading text-lg font-bold text-on-surface">{topGenres.length}</div>
						<div className="text-xs text-on-surface-variant">Genres</div>
					</div>
				</div>

				{/* Top Genres */}
				{topGenres.length > 0 && (
					<div className="mb-4">
						<h4 className="text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-wider">
							Top genres
						</h4>
						<div className="space-y-1.5">
							{topGenres.map((g) => (
								<PercentageBar
									key={g.name}
									label={g.name}
									percentage={g.percentage}
									color="bg-primary"
								/>
							))}
						</div>
					</div>
				)}

				{/* Top Decades */}
				{topDecades.length > 0 && (
					<div className="mb-4">
						<h4 className="text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-wider">
							Top decades
						</h4>
						<div className="space-y-1.5">
							{topDecades.map((d) => (
								<PercentageBar
									key={d.decade}
									label={d.decade}
									percentage={d.percentage}
									color="bg-secondary"
								/>
							))}
						</div>
					</div>
				)}

				{/* Top Countries */}
				{topCountries.length > 0 && (
					<div>
						<h4 className="text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-wider">
							Top origins
						</h4>
						<div className="flex flex-wrap gap-2">
							{topCountries.map((c) => (
								<span
									key={c.name}
									className="text-xs px-2 py-1 rounded-full bg-surface-container text-on-surface-variant"
								>
									{c.name} ({c.count})
								</span>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
