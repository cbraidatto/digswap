import Image from "next/image";
import { TrustStrip } from "@/components/trust/trust-strip";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import type { UserBadge } from "@/lib/gamification/queries";
import { BadgeRow } from "./badge-row";
import { CoverBanner } from "./cover-banner";
import { EditProfileModal } from "./edit-profile-modal";
import { FollowList } from "./follow-list";
import { NowSpinning } from "./now-spinning";
import { RankCard } from "./rank-card";
import { ShowcaseCards } from "./showcase-cards";
import { SocialLinks } from "./social-links";

interface ProfileHeroProps {
	profile: {
		id: string;
		displayName: string | null;
		username: string | null;
		avatarUrl: string | null;
		bio: string | null;
		location: string | null;
		coverUrl: string | null;
		coverPositionY: string | null;
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
		weeklyAdds: number;
		tradesThisWeek: number;
		wantlistFound: number;
	};
	topGenres: { genre: string; count: number }[];
	showcase: {
		searching: unknown;
		rarest: unknown;
		favorite: unknown;
	};
	badges: UserBadge[];
	isOwner: boolean;
}

export function ProfileHero({
	profile,
	stats,
	topGenres,
	showcase,
	badges,
	isOwner,
}: ProfileHeroProps) {
	const displayName = profile.displayName || "DIGGER";
	const isPremium =
		profile.subscriptionTier === "premium_monthly" || profile.subscriptionTier === "premium_annual";

	return (
		<div className="mb-8">
			{/* Cover Banner — full bleed */}
			<CoverBanner
				initialCoverUrl={profile.coverUrl}
				initialPositionY={Number(profile.coverPositionY ?? 50)}
				isOwner={isOwner}
			/>

			{/* Bento Grid Header */}
			<section className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
				{/* ── Identity Card (left) ── */}
				<div className="md:col-span-4 bg-surface-container-low p-6 rounded-lg relative overflow-hidden">
					<div className="relative z-10">
						{/* Avatar + name */}
						<div className="flex items-start gap-4 mb-4">
							<div className="w-16 h-16 flex-shrink-0 bg-surface-container-high rounded border-2 border-primary/20 overflow-hidden flex items-center justify-center">
								{profile.avatarUrl ? (
									<Image
										src={profile.avatarUrl}
										alt={displayName}
										width={64}
										height={64}
										unoptimized
										className="w-full h-full object-cover rounded"
									/>
								) : (
									<span className="text-2xl font-mono font-bold text-primary">
										{displayName.charAt(0).toUpperCase()}
									</span>
								)}
							</div>
							<div className="flex-1 min-w-0 pt-0.5">
								<div className="flex items-center gap-2 mb-0.5">
									<h1 className="text-2xl font-bold tracking-tight font-heading leading-none truncate">
										{displayName.toUpperCase()}
									</h1>
									{isPremium && <PremiumBadge />}
								</div>
								{profile.username && (
									<p className="font-mono text-xs text-primary/60 mb-0.5">@{profile.username}</p>
								)}
								{profile.location && (
									<div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant">
										<span className="material-symbols-outlined text-sm leading-none">
											location_on
										</span>
										{profile.location}
									</div>
								)}
							</div>
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
						<div className="mt-3">
							<TrustStrip userId={profile.id} variant="full" />
						</div>

						{/* Divider */}
						<div className="border-t border-outline/10 my-4" />

						{/* Follow counts + Edit */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-3 font-mono text-xs">
								<FollowList userId={profile.id} type="following" count={stats.followingCount} />
								<span className="text-outline">&middot;</span>
								<FollowList userId={profile.id} type="followers" count={stats.followerCount} />
							</div>
							{isOwner && (
								<EditProfileModal
									initial={{
										displayName: profile.displayName ?? "",
										username: profile.username ?? "",
										location: profile.location ?? "",
										bio: profile.bio ?? "",
										youtubeUrl: profile.youtubeUrl ?? "",
										instagramUrl: profile.instagramUrl ?? "",
										soundcloudUrl: profile.soundcloudUrl ?? "",
										discogsUrl: profile.discogsUrl ?? "",
										beatportUrl: profile.beatportUrl ?? "",
										avatarUrl: profile.avatarUrl ?? null,
									}}
								/>
							)}
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
								className="mt-3 rounded border border-outline/15 bg-black/40 px-3 py-2.5 max-h-[180px] overflow-y-auto"
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

				{/* ── Digging Activity (right) ── */}
				<div className="md:col-span-8 bg-surface-container-low p-6 rounded-lg flex flex-col gap-5">
					<h3 className="text-xs font-mono uppercase tracking-[0.2em] text-tertiary">
						Digging Activity
					</h3>

					{/* Stats row */}
					<div className="grid grid-cols-2 gap-3">
						{/* Week activity */}
						<div className="bg-surface-container-high rounded-lg border border-outline/[0.07] flex flex-col">
							<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant px-4 pt-3 flex items-center gap-1.5">
								<span className="material-symbols-outlined text-[13px] text-tertiary">
									calendar_month
								</span>
								Week Activity
							</p>
							<div className="flex divide-x divide-outline/[0.07] flex-1">
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-primary">
										playlist_add
									</span>
									<p className="text-3xl font-bold font-heading text-primary leading-none">
										{stats.weeklyAdds}
									</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">
										Added
									</p>
								</div>
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-tertiary">
										swap_horiz
									</span>
									<p className="text-3xl font-bold font-heading text-tertiary leading-none">
										{stats.tradesThisWeek}
									</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">
										Trades
									</p>
								</div>
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-secondary">
										task_alt
									</span>
									<p className="text-3xl font-bold font-heading text-secondary leading-none">
										{stats.wantlistFound}
									</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">
										Found
									</p>
								</div>
							</div>
						</div>

						{/* Top genres */}
						<div className="bg-surface-container-high rounded-lg p-4 border border-outline/[0.07]">
							<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant mb-2 flex items-center gap-1.5">
								<span className="material-symbols-outlined text-[13px] text-secondary">
									queue_music
								</span>
								Top Genres
							</p>
							{topGenres.length > 0 ? (
								<ol className="space-y-1.5">
									{topGenres.map((g, i) => (
										<li key={g.genre} className="flex items-center gap-2 min-w-0">
											<span className="font-mono text-[9px] text-outline w-2.5 flex-shrink-0">
												{i + 1}
											</span>
											<span className="font-mono text-xs text-on-surface truncate flex-1">
												{g.genre}
											</span>
											<span className="font-mono text-xs text-secondary flex-shrink-0">
												{g.count}
											</span>
										</li>
									))}
								</ol>
							) : (
								<p className="font-mono text-xs text-outline/60 italic">no data yet</p>
							)}
						</div>
					</div>

					{/* Showcase */}
					<ShowcaseCards
						searching={showcase.searching as any}
						rarest={showcase.rarest as any}
						favorite={showcase.favorite as any}
						isOwner={isOwner}
					/>
				</div>
			</section>
		</div>
	);
}
