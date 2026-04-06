import Link from "next/link";
import { RankCard } from "./rank-card";
import { ShowcaseCards } from "./showcase-cards";
import { HolyGrailSelector } from "./holy-grail-selector";
import { RarityCardModal } from "./rarity-card-modal";
import { ShareSurface } from "@/components/share/share-surface";
import { TrustStrip } from "@/components/trust/trust-strip";
import { signOgParams } from "@/lib/og/sign";

interface AboutTabProps {
	userId: string;
	profile: {
		username: string | null;
		displayName: string | null;
		holyGrailIds: string[] | null;
	};
	stats: {
		collectionCount: number;
		globalRank: number | null;
		rankTitle: string;
		rarityScore: number;
		contributionScore: number;
		totalTrades: number;
	};
	showcase: {
		searching: unknown;
		rarest: unknown;
		favorite: unknown;
	};
	wantlistItems: { id: string; releaseTitle: string | null; releaseArtist: string | null }[];
	topGenres: { genre: string; count: number }[];
	isOwner: boolean;
}

export function AboutTab({
	userId,
	profile,
	stats,
	showcase,
	wantlistItems,
	topGenres,
	isOwner,
}: AboutTabProps) {
	const globalScore = stats.rarityScore * 0.7 + stats.contributionScore * 0.3;

	return (
		<div className="space-y-8">
			{/* Stats grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[
					{ label: "Records", value: stats.collectionCount.toLocaleString(), color: "text-primary", icon: "album" },
					{ label: "Rank", value: stats.globalRank ? `#${stats.globalRank}` : "—", color: "text-secondary", icon: "leaderboard" },
					{ label: "Score", value: globalScore.toFixed(1), color: "text-tertiary", icon: "score" },
					{ label: "Trades", value: stats.totalTrades.toLocaleString(), color: "text-primary", icon: "swap_horiz" },
				].map((s) => (
					<div key={s.label} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5">
						<div className="flex items-center gap-1.5 mb-1.5">
							<span className={`material-symbols-outlined text-[14px] ${s.color}`}>{s.icon}</span>
							<span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">{s.label}</span>
						</div>
						<div className={`text-2xl font-bold font-heading ${s.color}`}>{s.value}</div>
					</div>
				))}
			</div>

			{/* Rank + Trust */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<RankCard
					title={stats.rankTitle}
					globalRank={stats.globalRank}
					rarityScore={stats.rarityScore}
					contributionScore={stats.contributionScore}
				/>
				<div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5">
					<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Trade Reputation</h3>
					<TrustStrip userId={userId} variant="full" />
				</div>
			</div>

			{/* Top genres */}
			{topGenres.length > 0 && (
				<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
					<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
						<span className="material-symbols-outlined text-[14px] text-secondary">fingerprint</span>
						Digger DNA
					</h3>
					<div className="flex gap-2 flex-wrap">
						{topGenres.map((g, i) => (
							<span
								key={g.genre}
								className="font-mono text-xs bg-surface-container-high px-3 py-1.5 rounded-full border border-outline-variant/10"
							>
								<span className="text-on-surface-variant/40 mr-1">{i + 1}.</span>
								<span className="text-on-surface">{g.genre}</span>
								<span className="text-primary ml-1.5">{g.count}</span>
							</span>
						))}
					</div>
				</div>
			)}

			{/* Showcase */}
			<ShowcaseCards
				searching={showcase.searching as any}
				rarest={showcase.rarest as any}
				favorite={showcase.favorite as any}
				isOwner={isOwner}
			/>

			{/* Holy Grails + Share tools — owner only */}
			{isOwner && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
						<HolyGrailSelector
							wantlistItems={wantlistItems}
							currentHolyGrailIds={profile.holyGrailIds ?? []}
						/>
					</div>
					<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5 space-y-4">
						<div>
							<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">Share your bounty</h3>
							<ShareSurface
								url={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/u/${profile.username}/bounty`}
								label="Bounty Link"
							/>
						</div>
						<div className="border-t border-outline-variant/5 pt-4">
							<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-2">Rarity Card</h3>
							<RarityCardModal
								username={profile.username ?? ""}
								appUrl={process.env.NEXT_PUBLIC_APP_URL ?? ""}
								displayName={profile.displayName ?? undefined}
								totalRecords={stats.collectionCount}
								avgRarity={stats.rarityScore}
								ogSig={signOgParams(profile.username ?? "", stats.collectionCount, 0, stats.rarityScore)}
							/>
						</div>
					</div>
				</div>
			)}

			{/* Links */}
			<div className="flex items-center gap-4">
				<Link href="/perfil/stats" className="font-mono text-xs text-secondary hover:underline">
					Full stats →
				</Link>
				<Link href="/crates" className="font-mono text-xs text-primary hover:underline">
					My crates →
				</Link>
				<Link href="/wrapped" className="font-mono text-xs text-tertiary hover:underline">
					Year in Crates →
				</Link>
			</div>
		</div>
	);
}
