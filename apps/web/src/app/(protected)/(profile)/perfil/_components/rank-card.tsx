interface RankCardProps {
	title: string;
	globalRank: number | null;
	gemScore: number;
	contributionScore: number;
}

export function RankCard({
	title,
	globalRank,
	gemScore,
	contributionScore,
}: RankCardProps) {
	return (
		<div className="bg-surface-container-high p-3 rounded border-l-2 border-secondary">
			<div className="flex items-center gap-2">
				<span className="material-symbols-outlined text-secondary">
					military_tech
				</span>
				<div>
					<div className="text-xs text-secondary font-mono uppercase tracking-widest">
						Class Status
					</div>
					<div className="text-sm font-bold font-heading">{title}</div>
				</div>
			</div>

			<div className="grid grid-cols-3 gap-3 mt-3">
				<div>
					<div className="text-xl font-bold font-heading text-secondary">
						{globalRank ? `#${globalRank}` : "—"}
					</div>
					<div className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">
						Global Rank
					</div>
				</div>
				<div>
					<div className="text-xl font-bold font-heading text-primary">
						{gemScore.toLocaleString()}
					</div>
					<div className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">
						Gem Score
					</div>
				</div>
				<div>
					<div className="text-xl font-bold font-heading text-tertiary">
						{contributionScore.toFixed(1)}
					</div>
					<div className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">
						Contribution
					</div>
				</div>
			</div>
		</div>
	);
}
