import Link from "next/link";
import { CountUp } from "@/components/ui/count-up";
import { RankCard } from "./rank-card";
import { ShowcaseCards } from "./showcase-cards";
import { HolyGrailSelector } from "./holy-grail-selector";
import { RarityCardModal } from "./rarity-card-modal";
import { ShareSurface } from "@/components/share/share-surface";
import { TrustStrip } from "@/components/trust/trust-strip";
import { signOgParams } from "@/lib/og/sign";
import { CollectionHeatmap } from "./collection-heatmap";
import { AchievementShelf } from "./achievement-shelf";
import { DnaRadarChart } from "./dna-radar-chart";
import type { UserBadge } from "@/lib/gamification/queries";

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
		gemScore: number;
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
	badges: UserBadge[];
	heatmapData: Record<string, number>;
	recentlyAdded: { title: string; artist: string; createdAt: string; discogsId: number | null }[];
	isOwner: boolean;
}

export function AboutTab({
	userId,
	profile,
	stats,
	showcase,
	wantlistItems,
	topGenres,
	badges,
	heatmapData,
	recentlyAdded,
	isOwner,
}: AboutTabProps) {
	const globalScore = stats.gemScore * 0.7 + stats.contributionScore * 0.3;

	return (
		<div className="space-y-8">
			{/* Stats grid */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
				{[
					{ label: "Records", value: stats.collectionCount.toLocaleString(), color: "text-primary", accent: "from-primary/10", icon: "album" },
					{ label: "Rank", value: stats.globalRank ? `#${stats.globalRank}` : "—", color: "text-secondary", accent: "from-secondary/10", icon: "leaderboard" },
					{ label: "Score", value: globalScore.toFixed(1), color: "text-tertiary", accent: "from-tertiary/10", icon: "score" },
					{ label: "Trades", value: stats.totalTrades.toLocaleString(), color: "text-primary", accent: "from-primary/10", icon: "swap_horiz" },
				].map((s) => (
					<div key={s.label} className={`relative overflow-hidden bg-surface-container-low rounded-xl p-4 border border-outline-variant/5`}>
						<div className={`absolute inset-0 bg-gradient-to-br ${s.accent} to-transparent opacity-50`} />
						<div className="relative">
							<div className="flex items-center gap-1.5 mb-1.5">
								<span className={`material-symbols-outlined text-[14px] ${s.color}`}>{s.icon}</span>
								<span className="font-mono text-[9px] text-on-surface-variant uppercase tracking-widest">{s.label}</span>
							</div>
							<div className={`text-2xl font-bold font-heading ${s.color}`}>
								{s.label === "Score" ? (
									<CountUp end={Number(s.value)} decimals={1} />
								) : s.value.startsWith("#") ? (
									<>#{s.value === "—" ? "—" : <CountUp end={Number(s.value.replace("#", ""))} prefix="" />}</>
								) : (
									<CountUp end={Number(s.value.replace(/,/g, ""))} />
								)}
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Rank + Trust */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<RankCard
					title={stats.rankTitle}
					globalRank={stats.globalRank}
					gemScore={stats.gemScore}
					contributionScore={stats.contributionScore}
				/>
				<div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5">
					<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3">Trade Reputation</h3>
					<TrustStrip userId={userId} variant="full" />
				</div>
			</div>

			{/* Digger DNA radar chart */}
			{topGenres.length >= 3 && <DnaRadarChart genres={topGenres} />}

			{/* Collection heatmap */}
			<CollectionHeatmap data={heatmapData} />

			{/* Recently Added */}
			{recentlyAdded.length > 0 && (
				<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
					<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
						<span className="material-symbols-outlined text-[14px] text-primary">history</span>
						Recently Added
					</h3>
					<div className="space-y-2">
						{recentlyAdded.map((r, i) => (
							<div key={`${r.title}-${i}`} className="flex items-center gap-3 font-mono text-xs">
								<span className="text-on-surface-variant/30 text-[9px] w-16 flex-shrink-0">
									{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
								</span>
								{r.discogsId ? (
									<Link href={`/release/${r.discogsId}`} className="text-on-surface hover:text-primary transition-colors truncate">
										{r.title}
									</Link>
								) : (
									<span className="text-on-surface truncate">{r.title}</span>
								)}
								<span className="text-on-surface-variant/40 truncate flex-shrink-0">
									{r.artist}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Achievement shelf */}
			<AchievementShelf earned={badges} />

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
								avgRarity={stats.gemScore}
								ogSig={signOgParams(profile.username ?? "", stats.collectionCount, 0, stats.gemScore)}
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
