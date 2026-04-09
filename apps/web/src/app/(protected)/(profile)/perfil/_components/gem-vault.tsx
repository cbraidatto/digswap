"use client";

import { CountUp } from "@/components/ui/count-up";
import { GEM_TIERS, type GemTier } from "@/lib/gems/constants";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface GemVaultProps {
	distribution: Record<GemTier, number>;
	totalGemScore: number;
	totalRecords: number;
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

function getGemGlowClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "";
		case "amethyst":
			return "drop-shadow-[0_0_6px_#8B5CF6]";
		case "emerald":
			return "drop-shadow-[0_0_6px_#10B981]";
		case "ruby":
			return "drop-shadow-[0_0_6px_#EF4444]";
		case "sapphire":
			return "drop-shadow-[0_0_8px_#3B82F6]";
		case "diamond":
			return "drop-shadow-[0_0_10px_#F0F9FF]";
		default:
			return "";
	}
}

function GemIcon({ tier, size = "text-2xl" }: { tier: GemTier; size?: string }) {
	return (
		<span
			className={`shrink-0 leading-none font-mono ${size} ${getGemTextClass(tier)} ${getGemGlowClass(tier)}`}
		>
			{GEM_GLYPH[tier]}
		</span>
	);
}

/* ------------------------------------------------------------------ */
/*  Per-tier Tailwind bg class                                        */
/* ------------------------------------------------------------------ */

function getGemBgClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "bg-gem-quartz";
		case "amethyst":
			return "bg-gem-amethyst";
		case "emerald":
			return "bg-gem-emerald";
		case "ruby":
			return "bg-gem-ruby";
		case "sapphire":
			return "bg-gem-sapphire";
		case "diamond":
			return "bg-gem-diamond";
		default:
			return "bg-gem-quartz";
	}
}

function getGemTextClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "text-gem-quartz";
		case "amethyst":
			return "text-gem-amethyst";
		case "emerald":
			return "text-gem-emerald";
		case "ruby":
			return "text-gem-ruby";
		case "sapphire":
			return "text-gem-sapphire";
		case "diamond":
			return "text-gem-diamond";
		default:
			return "text-gem-quartz";
	}
}

function _getGemBorderClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "border-l-gem-quartz";
		case "amethyst":
			return "border-l-gem-amethyst";
		case "emerald":
			return "border-l-gem-emerald";
		case "ruby":
			return "border-l-gem-ruby";
		case "sapphire":
			return "border-l-gem-sapphire";
		case "diamond":
			return "border-l-gem-diamond";
		default:
			return "border-l-gem-quartz";
	}
}

function getGemHighlightClass(tier: GemTier): string {
	switch (tier) {
		case "quartz":
			return "bg-gem-quartz/8 border border-gem-quartz/20";
		case "amethyst":
			return "bg-gem-amethyst/8 border border-gem-amethyst/20";
		case "emerald":
			return "bg-gem-emerald/8 border border-gem-emerald/20";
		case "ruby":
			return "bg-gem-ruby/8 border border-gem-ruby/20";
		case "sapphire":
			return "bg-gem-sapphire/8 border border-gem-sapphire/20";
		case "diamond":
			return "bg-gem-diamond/8 border border-gem-diamond/20";
		default:
			return "bg-gem-quartz/8 border border-gem-quartz/20";
	}
}

/* ------------------------------------------------------------------ */
/*  GemVault                                                          */
/* ------------------------------------------------------------------ */

export function GemVault({ distribution, totalGemScore, totalRecords }: GemVaultProps) {
	// Empty state
	if (totalRecords === 0) {
		return (
			<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
				<div className="flex items-center gap-1.5 mb-3">
					<span className="material-symbols-outlined text-[14px] text-on-surface-variant">
						diamond
					</span>
					<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
						Gem Vault
					</span>
				</div>
				<h4 className="font-heading text-lg font-bold text-on-surface mb-1">No gems yet</h4>
				<p className="font-mono text-xs text-on-surface-variant/60">
					Import your Discogs collection to see your gems.
				</p>
			</div>
		);
	}

	// Calculate total for distribution bar proportions
	const totalDistribution = Object.values(distribution).reduce((sum, n) => sum + n, 0);

	// Find rarest tier (highest-weight tier with count > 0)
	const rarestTier = [...GEM_TIERS].reverse().find((t) => distribution[t.key] > 0)?.key ?? null;

	return (
		<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
			{/* Header */}
			<div className="flex items-center justify-between mb-4">
				<div className="flex items-center gap-1.5">
					<span className="material-symbols-outlined text-[14px] text-on-surface-variant">
						diamond
					</span>
					<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
						Gem Vault
					</span>
				</div>
				<div className="text-right">
					<div className="text-2xl font-bold font-heading text-primary">
						<CountUp end={totalGemScore} />
					</div>
					<span className="font-mono text-[9px] text-on-surface-variant/50 uppercase tracking-widest">
						Gem Score
					</span>
				</div>
			</div>

			{/* Distribution bar */}
			<div className="flex h-7 rounded-md overflow-hidden mb-4">
				{GEM_TIERS.map((tier) => {
					const count = distribution[tier.key];
					if (count === 0) return null;
					const pct = (count / totalDistribution) * 100;
					return (
						<div
							key={tier.key}
							className={`${getGemBgClass(tier.key)} transition-all duration-500`}
							style={{ width: `max(4px, ${pct}%)` }}
							title={`${tier.name}: ${count}`}
						/>
					);
				})}
			</div>

			{/* Tier breakdown grid */}
			<div className="grid grid-cols-3 md:grid-cols-6 gap-2">
				{GEM_TIERS.map((tier) => {
					const count = distribution[tier.key];
					const isRarest = tier.key === rarestTier;
					const isEmpty = count === 0;

					return (
						<div
							key={tier.key}
							className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${
								isRarest
									? getGemHighlightClass(tier.key)
									: isEmpty
										? "opacity-25"
										: "bg-surface-container-high/30 hover:bg-surface-container-high/50"
							}`}
						>
							<GemIcon tier={tier.key} size="text-2xl" />
							<span
								className={`font-mono text-[9px] uppercase tracking-wider ${isEmpty ? "text-on-surface-variant/50" : getGemTextClass(tier.key)}`}
							>
								{tier.name}
							</span>
							<span
								className={`font-mono text-base font-bold ${isEmpty ? "text-on-surface-variant/30" : "text-on-surface"}`}
							>
								{count}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
