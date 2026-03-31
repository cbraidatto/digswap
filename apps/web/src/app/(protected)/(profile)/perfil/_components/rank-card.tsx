interface RankCardProps {
	title: string;
	globalRank: number | null;
	rarityScore: number;
	contributionScore: number;
}

export function RankCard({
	title,
	globalRank,
	rarityScore,
	contributionScore,
}: RankCardProps) {
	return (
		<div className="bg-surface-container-high p-3 rounded border-l-2 border-secondary">
			<div className="flex items-center gap-2">
				<span className="material-symbols-outlined text-secondary">
					military_tech
				</span>
				<div>
					<div className="text-[10px] text-secondary font-mono uppercase tracking-widest">
						Class Status
					</div>
					<div className="text-sm font-bold font-heading">{title}</div>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2 mt-3">
				<div>
					<div className="text-2xl font-bold font-heading text-secondary">
						{globalRank ? `#${globalRank}` : "#--"}
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						GLOBAL_RANK
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						Score_pts
					</div>
				</div>
				<div>
					<div className="text-2xl font-bold font-heading text-primary">
						{rarityScore.toFixed(1)}
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						RARITY
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						Score_pts
					</div>
				</div>
				<div>
					<div className="text-2xl font-bold font-heading text-tertiary">
						{contributionScore.toFixed(1)}
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						CONTRIBUTION
					</div>
					<div className="font-mono text-[10px] text-outline uppercase">
						Score_pts
					</div>
				</div>
			</div>
		</div>
	);
}
