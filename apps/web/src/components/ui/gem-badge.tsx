import { type GemTier, getGemInfo, getGemTier } from "@/lib/gems/constants";

/* ------------------------------------------------------------------ */
/*  Per-tier styling (background, text, border, glow)                  */
/* ------------------------------------------------------------------ */

function getGemStyle(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "bg-gem-quartz/10 text-gem-quartz border-gem-quartz/30 shadow-gem-quartz/5";
		case "amethyst":
			return "bg-gem-amethyst/15 text-gem-amethyst border-gem-amethyst/30 shadow-gem-amethyst/10";
		case "emerald":
			return "bg-gem-emerald/15 text-gem-emerald border-gem-emerald/30 shadow-gem-emerald/10";
		case "ruby":
			return "bg-gem-ruby/15 text-gem-ruby border-gem-ruby/30 shadow-gem-ruby/10";
		case "sapphire":
			return "bg-gem-sapphire/15 text-gem-sapphire border-gem-sapphire/30 shadow-gem-sapphire/15";
		case "diamond":
			return "bg-gem-diamond/15 text-gem-diamond border-gem-diamond/40 shadow-gem-diamond/20";
		default:
			return "";
	}
}

/* ------------------------------------------------------------------ */
/*  Per-tier hover effect class                                        */
/* ------------------------------------------------------------------ */

function getGemEffectClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "";
		case "amethyst":
			return "hover:animate-gem-glow-purple";
		case "emerald":
			return "hover:animate-gem-shimmer-green";
		case "ruby":
			return "hover:animate-gem-pulse-warm";
		case "sapphire":
			return "hover:animate-gem-glow-blue";
		case "diamond":
			return "animate-gem-prismatic animate-gem-rainbow-edge";
		default:
			return "";
	}
}

/* ------------------------------------------------------------------ */
/*  Gem glyphs — terminal-style geometric unicode                      */
/* ------------------------------------------------------------------ */

const GEM_GLYPH: Record<GemTier, string> = {
	quartz: "◇",
	amethyst: "⬡",
	emerald: "◈",
	ruby: "✦",
	sapphire: "◆",
	diamond: "❖",
};

function GemIcon({ tier }: { tier: GemTier }) {
	return <span className="shrink-0 leading-none font-mono">{GEM_GLYPH[tier]}</span>;
}

/* ------------------------------------------------------------------ */
/*  GemBadge                                                           */
/* ------------------------------------------------------------------ */

interface GemBadgeProps {
	/** Raw rarity score (want/have ratio) */
	score: number | null | undefined;
	/** Show weight multiplier (e.g., x100) */
	showScore?: boolean;
	/** Additional Tailwind classes */
	className?: string;
}

export function GemBadge({ score, showScore = false, className = "" }: GemBadgeProps) {
	const tier = getGemTier(score ?? null);
	if (!tier) return null;

	const info = getGemInfo(tier);

	return (
		<span
			role="img"
			aria-label={`${info.name} gem, weight ${info.weight}`}
			className={`inline-flex items-center gap-1.5 font-mono text-[10px] font-bold px-2.5 py-1 rounded-full border shadow-sm whitespace-nowrap ${getGemStyle(tier)} ${getGemEffectClass(tier)} ${className}`}
		>
			<GemIcon tier={tier} />
			{info.name}
			{showScore && score != null && <span className="opacity-60 text-[9px]">x{info.weight}</span>}
		</span>
	);
}
