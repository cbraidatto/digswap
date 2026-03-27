import type { LeaderboardEntry } from "@/lib/gamification/queries";

interface LeaderboardRowProps {
	rank: number | null;
	username: string | null;
	title: string | null;
	score: number;
	isOwnUser: boolean;
}

export function LeaderboardRow({
	rank,
	username,
	title,
	score,
	isOwnUser,
}: LeaderboardRowProps) {
	return (
		<li
			className={`h-12 flex items-center gap-2 px-3 rounded-lg border ${
				isOwnUser
					? "border-l-2 border-primary bg-surface-container-high/50"
					: "border-outline-variant/10 bg-surface-container-low"
			}`}
			aria-current={isOwnUser ? "true" : undefined}
		>
			{/* Rank */}
			<span
				className={`font-mono text-sm w-12 flex-shrink-0 ${
					isOwnUser ? "text-primary font-bold" : "text-on-surface"
				}`}
			>
				#{rank ?? "--"}
			</span>

			{/* Dot separator */}
			<span className="font-mono text-[10px] text-outline">&middot;</span>

			{/* Username */}
			<span className="font-mono text-[10px] text-on-surface flex-1 truncate">
				{username ?? "unknown"}
			</span>

			{/* Title */}
			<span className="font-mono text-[10px] text-secondary flex-shrink-0">
				{title ?? ""}
			</span>

			{/* Score */}
			<span className="font-mono text-sm text-primary tabular-nums text-right">
				{score.toFixed(1)}pts
			</span>
		</li>
	);
}
