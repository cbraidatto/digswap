import Image from "next/image";
import { TrustStrip } from "@/components/trust/trust-strip";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import type { UserBadge } from "@/lib/gamification/queries";
import { BadgeRow } from "./badge-row";
import { FollowList } from "./follow-list";
import { NowSpinning } from "./now-spinning";
import { RankCard } from "./rank-card";
import { ShowcaseCards, type ShowcaseRelease } from "./showcase-cards";
import { SocialLinks } from "./social-links";

interface ProfileSidebarProps {
	profile: {
		id: string;
		displayName: string | null;
		username: string | null;
		avatarUrl: string | null;
		bio: string | null;
		location: string | null;
		subscriptionTier: string | null;
		youtubeUrl: string | null;
		instagramUrl: string | null;
		soundcloudUrl: string | null;
		discogsUrl: string | null;
		beatportUrl: string | null;
	};
	stats: {
		collectionCount: number;
		followingCount: number;
		followerCount: number;
		globalRank: number | null;
		rankTitle: string;
		gemScore: number;
		contributionScore: number;
	};
	showcase: {
		searching: ShowcaseRelease | null;
		rarest: ShowcaseRelease | null;
		favorite: ShowcaseRelease | null;
	};
	badges: UserBadge[];
	isOwner: boolean;
}

export function ProfileSidebar({ profile, stats, showcase, badges, isOwner }: ProfileSidebarProps) {
	const displayName = profile.displayName || "DIGGER";
	const isPremium =
		profile.subscriptionTier === "premium_monthly" || profile.subscriptionTier === "premium_annual";

	return (
		<aside className="space-y-4 min-w-0">
			{/* Avatar + Identity */}
			<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5 relative overflow-visible">
				<div className="relative z-10">
					{/* Avatar overlapping banner */}
					<div className="-mt-14 mb-3">
						<div className="w-32 h-32 bg-surface-container-high rounded-xl border-4 border-surface-dim overflow-visible flex items-center justify-center shadow-lg">
							{profile.avatarUrl ? (
								<Image
									src={profile.avatarUrl}
									alt={displayName}
									width={128}
									height={128}
									unoptimized
									className="w-32 h-32 object-cover rounded-xl"
								/>
							) : (
								<span className="text-4xl font-mono font-bold text-primary">
									{displayName.charAt(0).toUpperCase()}
								</span>
							)}
						</div>
					</div>

					{/* Name */}
					<div className="flex items-center gap-2 mb-0.5">
						<h1 className="text-xl font-bold tracking-tight font-heading leading-none truncate">
							{displayName.toUpperCase()}
						</h1>
						{isPremium && <PremiumBadge />}
					</div>
					{profile.username && (
						<p className="font-mono text-xs text-primary/60 mb-0.5">@{profile.username}</p>
					)}
					{profile.location && (
						<div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant mb-3">
							<span className="material-symbols-outlined text-sm leading-none">location_on</span>
							{profile.location}
						</div>
					)}

					{/* Compact stats line */}
					<div className="flex items-center gap-2 font-mono text-xs text-on-surface-variant mb-4 flex-wrap">
						<span>
							<span className="text-on-surface font-bold">{stats.collectionCount}</span> records
						</span>
						<span className="text-outline/30">·</span>
						<span>
							<span className="text-on-surface font-bold">
								{stats.globalRank ? `#${stats.globalRank}` : "—"}
							</span>{" "}
							rank
						</span>
						<span className="text-outline/30">·</span>
						<span>
							<span className="text-on-surface font-bold">{stats.gemScore}</span> gems
						</span>
					</div>

					{/* Rank Card */}
					<RankCard
						title={stats.rankTitle}
						globalRank={stats.globalRank}
						gemScore={stats.gemScore}
						contributionScore={stats.contributionScore}
					/>

					{/* Badge Row */}
					<BadgeRow badges={badges} />

					{/* Trust Strip */}
					<div className="mt-4">
						<TrustStrip userId={profile.id} variant="full" />
					</div>

					{/* Divider */}
					<div className="border-t border-outline/10 my-5" />

					{/* Follow counts */}
					<div className="flex items-center gap-3 font-mono text-xs mb-4">
						<FollowList userId={profile.id} type="following" count={stats.followingCount} />
						<span className="text-outline">&middot;</span>
						<FollowList userId={profile.id} type="followers" count={stats.followerCount} />
					</div>

					{/* Social links */}
					<SocialLinks
						youtube={profile.youtubeUrl}
						instagram={profile.instagramUrl}
						soundcloud={profile.soundcloudUrl}
						discogs={profile.discogsUrl}
						beatport={profile.beatportUrl}
					/>

					{/* Bio */}
					{profile.bio && (
						<div
							className="mt-3 rounded border border-outline/15 bg-black/40 px-3 py-2.5 max-h-[140px] overflow-y-auto"
							style={{
								scrollbarWidth: "thin",
								scrollbarColor: "rgba(255,255,255,0.15) transparent",
							}}
						>
							<p className="font-mono text-xs text-on-surface-variant leading-relaxed break-words whitespace-pre-wrap">
								{profile.bio}
							</p>
						</div>
					)}

					{/* Now Spinning */}
					<div className="mt-3">
						<NowSpinning />
					</div>
				</div>

				{/* Decorative dot grid */}
				<div
					className="absolute inset-0 opacity-5 pointer-events-none"
					style={{
						backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
						backgroundSize: "20px 20px",
					}}
				/>
			</div>

			{/* Showcase Cards */}
			<div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5 overflow-hidden">
				<p className="font-mono text-[10px] text-on-surface-variant uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5">
					<span className="material-symbols-outlined text-[13px] text-primary">auto_awesome</span>
					Showcase
				</p>
				<ShowcaseCards
					searching={showcase.searching}
					rarest={showcase.rarest}
					favorite={showcase.favorite}
					isOwner={isOwner}
					compact
				/>
			</div>
		</aside>
	);
}
