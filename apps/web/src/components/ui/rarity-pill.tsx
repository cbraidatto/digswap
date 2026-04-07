import { getRarityTier, type RarityTier } from "@/lib/collection/rarity";

function getStyle(tier: RarityTier) {
	switch (tier) {
		case "Ultra Rare":
			return "bg-tertiary/10 text-tertiary border-tertiary/25";
		case "Rare":
			return "bg-secondary/10 text-secondary border-secondary/25";
		default:
			return "bg-primary/10 text-primary border-primary/25";
	}
}

interface RarityPillProps {
	score: number | null | undefined;
	/** Show the numeric score alongside the tier label */
	showScore?: boolean;
	className?: string;
}

export function RarityPill({ score, showScore = true, className = "" }: RarityPillProps) {
	const tier = getRarityTier(score ?? null);
	if (!tier) return null;

	return (
		<span
			className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getStyle(tier)} ${className}`}
		>
			{tier}
			{showScore && score != null && <span className="opacity-70">· {score.toFixed(1)}</span>}
		</span>
	);
}
