import { getGemInfo, getGemTier, type GemTier } from "@/lib/gems/constants";
import { Diamond, Gem, Hexagon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Per-tier styling (background, text, border)                       */
/* ------------------------------------------------------------------ */

function getGemStyle(tier: GemTier): string {
  switch (tier) {
    case "quartz":
      return "bg-gem-quartz/10 text-gem-quartz border-gem-quartz/25";
    case "amethyst":
      return "bg-gem-amethyst/10 text-gem-amethyst border-gem-amethyst/25";
    case "emerald":
      return "bg-gem-emerald/10 text-gem-emerald border-gem-emerald/25";
    case "ruby":
      return "bg-gem-ruby/10 text-gem-ruby border-gem-ruby/25";
    case "sapphire":
      return "bg-gem-sapphire/10 text-gem-sapphire border-gem-sapphire/25";
    case "diamond":
      return "bg-gem-diamond/10 text-gem-diamond border-gem-diamond/25";
    default:
      return "";
  }
}

/* ------------------------------------------------------------------ */
/*  Per-tier hover effect class                                       */
/* ------------------------------------------------------------------ */

function getGemEffectClass(tier: GemTier): string {
  switch (tier) {
    case "quartz":
      return ""; // no effect
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
/*  Inline GemIcon — maps tier to Lucide icon                         */
/* ------------------------------------------------------------------ */

function GemIcon({ tier, size = 12 }: { tier: GemTier; size?: number }) {
  const props = {
    size,
    strokeWidth: 2,
    fill: "currentColor",
    fillOpacity: 0.3,
    className: "shrink-0",
  };

  switch (tier) {
    case "quartz":
      return <Hexagon {...props} />;
    case "amethyst":
    case "emerald":
    case "ruby":
      return <Gem {...props} />;
    case "sapphire":
    case "diamond":
      return <Diamond {...props} />;
    default:
      return <Gem {...props} />;
  }
}

/* ------------------------------------------------------------------ */
/*  GemBadge — replaces RarityPill                                    */
/* ------------------------------------------------------------------ */

interface GemBadgeProps {
  /** Raw rarity score (want/have ratio) */
  score: number | null | undefined;
  /** Show weight multiplier (e.g., x100) */
  showScore?: boolean;
  /** Additional Tailwind classes */
  className?: string;
}

export function GemBadge({
  score,
  showScore = false,
  className = "",
}: GemBadgeProps) {
  const tier = getGemTier(score ?? null);
  if (!tier) return null;

  const info = getGemInfo(tier);

  return (
    <span
      aria-label={`${info.name} gem, weight ${info.weight}`}
      className={`inline-flex items-center gap-1 font-mono text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${getGemStyle(tier)} ${getGemEffectClass(tier)} ${className}`}
    >
      <GemIcon tier={tier} />
      {info.name}
      {showScore && score != null && (
        <span className="opacity-70">x{info.weight}</span>
      )}
    </span>
  );
}
