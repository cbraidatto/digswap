"use client";

import { cn } from "@/lib/utils";

interface Challenge {
	id: string;
	title: string;
	description: string | null;
	type: string;
	progress: number;
	goal: number;
	joined: boolean;
	completed: boolean;
	endsAt: string;
}

interface ChallengesCardProps {
	challenges: Challenge[];
	onJoin?: (challengeId: string) => void;
}

function daysUntil(dateStr: string): number {
	return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

const typeIcons: Record<string, string> = {
	genre_dive: "music_note",
	decade_dig: "calendar_month",
	label_hunt: "label",
	country_quest: "public",
};

export function ChallengesCard({ challenges, onJoin }: ChallengesCardProps) {
	if (challenges.length === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 p-6 text-center">
				<span className="material-symbols-outlined text-3xl text-on-surface-variant/30 mb-2 block">
					emoji_events
				</span>
				<h3 className="font-heading text-sm font-semibold text-on-surface mb-1">No active challenges</h3>
				<p className="text-xs text-on-surface-variant">
					Check back soon — new challenges drop every week.
				</p>
			</div>
		);
	}

	return (
		<div className="bg-surface-container-low rounded-xl border border-outline-variant/10 overflow-hidden">
			<div className="p-5 pb-3 flex items-center gap-2">
				<span className="material-symbols-outlined text-xl text-tertiary">
					emoji_events
				</span>
				<h3 className="font-heading text-base font-semibold text-on-surface">
					Dig Challenges
				</h3>
			</div>

			<div className="px-5 pb-5 space-y-3">
				{challenges.map((c) => {
					const progressPct = c.goal > 0 ? Math.round((c.progress / c.goal) * 100) : 0;
					const days = daysUntil(c.endsAt);
					const icon = typeIcons[c.type] ?? "flag";

					return (
						<div
							key={c.id}
							className={cn(
								"p-3 rounded-lg border transition-all",
								c.completed
									? "bg-primary/5 border-primary/20"
									: "bg-surface-container/50 border-outline-variant/10",
							)}
						>
							<div className="flex items-start gap-3">
								<div className={cn(
									"w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
									c.completed ? "bg-primary/15" : "bg-surface-container-high",
								)}>
									<span className={cn(
										"material-symbols-outlined text-base",
										c.completed ? "text-primary" : "text-on-surface-variant",
									)}>
										{c.completed ? "check_circle" : icon}
									</span>
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between gap-2">
										<h4 className="text-sm font-medium text-on-surface truncate">
											{c.title}
										</h4>
										{!c.completed && (
											<span className="text-xs text-on-surface-variant flex-shrink-0">
												{days}d left
											</span>
										)}
									</div>

									{c.description && (
										<p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">
											{c.description}
										</p>
									)}

									{c.joined && (
										<div className="mt-2">
											<div className="flex items-center justify-between text-xs mb-1">
												<span className="text-on-surface-variant">
													{c.progress}/{c.goal}
												</span>
												<span className={cn(
													"font-medium",
													c.completed ? "text-primary" : "text-on-surface-variant",
												)}>
													{progressPct}%
												</span>
											</div>
											<div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
												<div
													className={cn(
														"h-full rounded-full transition-all",
														c.completed ? "bg-primary" : "bg-secondary",
													)}
													style={{ width: `${Math.min(progressPct, 100)}%` }}
												/>
											</div>
										</div>
									)}

									{!c.joined && !c.completed && onJoin && (
										<button
											type="button"
											onClick={() => onJoin(c.id)}
											className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
										>
											Join challenge →
										</button>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
