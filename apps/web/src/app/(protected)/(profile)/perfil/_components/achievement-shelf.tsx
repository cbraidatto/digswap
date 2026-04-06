import type { UserBadge } from "@/lib/gamification/queries";

const BADGE_ICONS: Record<string, { icon: string; color: string }> = {
	first_dig: { icon: "album", color: "text-primary" },
	century_club: { icon: "workspace_premium", color: "text-secondary" },
	rare_find: { icon: "diamond", color: "text-tertiary" },
	crew_member: { icon: "group", color: "text-primary" },
	critic: { icon: "rate_review", color: "text-secondary" },
};

const ALL_BADGES = [
	{ slug: "first_dig", name: "First Dig", description: "Added your first record" },
	{ slug: "century_club", name: "Century Club", description: "100 records in collection" },
	{ slug: "rare_find", name: "Rare Find", description: "Found an ultra-rare record" },
	{ slug: "crew_member", name: "Crew Member", description: "Joined a community group" },
	{ slug: "critic", name: "Critic", description: "Wrote your first review" },
];

interface AchievementShelfProps {
	earned: UserBadge[];
}

export function AchievementShelf({ earned }: AchievementShelfProps) {
	const earnedSlugs = new Set(earned.map((b) => b.slug));

	return (
		<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
			<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-4 flex items-center gap-1.5">
				<span className="material-symbols-outlined text-[14px] text-tertiary">emoji_events</span>
				Achievements
			</h3>
			<div className="flex items-center gap-4 justify-center">
				{ALL_BADGES.map((badge) => {
					const isEarned = earnedSlugs.has(badge.slug);
					const visual = BADGE_ICONS[badge.slug] ?? { icon: "star", color: "text-primary" };

					return (
						<div
							key={badge.slug}
							className="flex flex-col items-center gap-1.5 group"
							title={`${badge.name}: ${badge.description}`}
						>
							<div
								className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${
									isEarned
										? `bg-surface-container-high border-2 border-primary/20 shadow-md shadow-primary/10 ${visual.color}`
										: "bg-surface-container-high/30 border-2 border-outline-variant/5 text-on-surface-variant/10"
								}`}
							>
								<span
									className="material-symbols-outlined text-xl"
									style={isEarned ? { fontVariationSettings: "'FILL' 1" } : undefined}
								>
									{visual.icon}
								</span>
							</div>
							<span
								className={`font-mono text-[8px] text-center leading-tight transition-colors ${
									isEarned
										? "text-on-surface-variant"
										: "text-on-surface-variant/15"
								}`}
							>
								{badge.name}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
