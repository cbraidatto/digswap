import { and, count, eq, gte, inArray, isNotNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { tradeRequests } from "@/lib/db/schema/trades";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionPage,
	getCollectionCount,
	getUniqueGenres,
	getUniqueFormats,
	getTopGenres,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { getFollowCounts } from "@/lib/social/queries";
import { CollectionGrid } from "./_components/collection-grid";
import { CollectionSkeleton } from "./_components/collection-skeleton";
import { FilterBar } from "./_components/filter-bar";
import { FollowList } from "./_components/follow-list";
import { Pagination } from "./_components/pagination";
import { AddRecordButton } from "./_components/add-record-button";
import { CoverBanner } from "./_components/cover-banner";
import { EditProfileModal } from "./_components/edit-profile-modal";
import { ShowcaseCards } from "./_components/showcase-cards";
import { SocialLinks } from "./_components/social-links";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getWantlistPage, getWantlistTotalCount, WANTLIST_PAGE_SIZE } from "@/lib/wantlist/queries";
import { WantlistAddButton } from "./_components/wantlist-add-button";
import { WantlistGrid } from "./_components/wantlist-grid";
import { AddToWantlistDialog } from "./_components/add-to-wantlist-dialog";
import { getUserRanking, getUserBadges } from "@/lib/gamification/queries";
import { getTradeReputation } from "@/lib/trades/queries";
import { RankCard } from "./_components/rank-card";
import { BadgeRow } from "./_components/badge-row";

interface PerfilPageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PerfilPage({ searchParams }: PerfilPageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	const [profile] = await db
		.select({
			displayName: profiles.displayName,
			avatarUrl: profiles.avatarUrl,
			coverUrl: profiles.coverUrl,
			coverPositionY: profiles.coverPositionY,
			username: profiles.username,
			location: profiles.location,
			bio: profiles.bio,
			createdAt: profiles.createdAt,
			youtubeUrl:    profiles.youtubeUrl,
			instagramUrl:  profiles.instagramUrl,
			soundcloudUrl: profiles.soundcloudUrl,
			discogsUrl:    profiles.discogsUrl,
			beatportUrl:   profiles.beatportUrl,
			showcaseSearchingId: profiles.showcaseSearchingId,
			showcaseRarestId:    profiles.showcaseRarestId,
			showcaseFavoriteId:  profiles.showcaseFavoriteId,
		})
		.from(profiles)
		.where(eq(profiles.id, user.id))
		.limit(1);

	const [{ value: collectionCount }] = await db
		.select({ value: count() })
		.from(collectionItems)
		.where(eq(collectionItems.userId, user.id));

	const displayName = profile?.displayName ?? "DIGGER";
	const memberYear = profile?.createdAt
		? new Date(profile.createdAt).getFullYear()
		: new Date().getFullYear();

	// Parse filters from search params
	const rawSearchParams = await searchParams;
	const filters = collectionFilterSchema.parse(rawSearchParams);

	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	// Collect showcase release IDs to fetch in one query
	const showcaseIds = [
		profile?.showcaseSearchingId,
		profile?.showcaseRarestId,
		profile?.showcaseFavoriteId,
	].filter((id): id is string => Boolean(id));

	// Fetch collection data, social counts and activity stats in parallel
	const [items, totalCount, genres, formats, followCounts, [{ weeklyAdds }], topGenres, showcaseReleases, [{ tradesThisWeek }], [{ wantlistCount }], wantlistData, wantlistTotal, [{ tradesTotal }], ranking, userBadgeData, tradeReputation] = await Promise.all([
		getCollectionPage(user.id, filters),
		getCollectionCount(user.id, filters),
		getUniqueGenres(user.id),
		getUniqueFormats(user.id),
		getFollowCounts(user.id),
		db.select({ weeklyAdds: count() })
			.from(collectionItems)
			.where(and(eq(collectionItems.userId, user.id), gte(collectionItems.createdAt, weekAgo))),
		getTopGenres(user.id),
		showcaseIds.length > 0
			? db.select({ id: releases.id, title: releases.title, artist: releases.artist, year: releases.year, coverImageUrl: releases.coverImageUrl })
				.from(releases)
				.where(inArray(releases.id, showcaseIds))
			: Promise.resolve([]),
		db.select({ tradesThisWeek: count() })
			.from(tradeRequests)
			.where(and(
				or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id)),
				gte(tradeRequests.createdAt, weekAgo),
			)),
		db.select({ wantlistCount: count() })
			.from(wantlistItems)
			.where(and(eq(wantlistItems.userId, user.id), isNotNull(wantlistItems.foundAt))),
	getWantlistPage(user.id, 1),
	getWantlistTotalCount(user.id),
	db.select({ tradesTotal: count() })
		.from(tradeRequests)
		.where(or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id))),
	getUserRanking(user.id),
	getUserBadges(user.id),
	getTradeReputation(user.id),
	]);

	const rankTitle = ranking?.title ?? "Vinyl Rookie";
	const globalRank = ranking?.globalRank ?? null;
	const rarityScore = ranking?.rarityScore ?? 0;
	const contributionScore = ranking?.contributionScore ?? 0;
	const globalScore = rarityScore * 0.7 + contributionScore * 0.3;

	const releaseById = Object.fromEntries(showcaseReleases.map((r) => [r.id, r]));
	const showcaseSearching = profile?.showcaseSearchingId ? (releaseById[profile.showcaseSearchingId] ?? null) : null;
	const showcaseRarest    = profile?.showcaseRarestId    ? (releaseById[profile.showcaseRarestId]    ?? null) : null;
	const showcaseFavorite  = profile?.showcaseFavoriteId  ? (releaseById[profile.showcaseFavoriteId]  ?? null) : null;

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

	return (
		<div>
			{/* Cover Banner — full bleed */}
			<CoverBanner
				initialCoverUrl={profile?.coverUrl ?? null}
				initialPositionY={Number(profile?.coverPositionY ?? 50)}
				isOwner={true}
			/>

		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* User Header Bento */}
			<section className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
				{/* Identity Card */}
				<div className="md:col-span-4 bg-surface-container-low p-6 rounded-lg relative overflow-hidden">
					<div className="relative z-10">
						{/* Avatar + name side by side */}
						<div className="flex items-start gap-4 mb-4">
							<div className="w-16 h-16 flex-shrink-0 bg-surface-container-high rounded border-2 border-primary/20 flex items-center justify-center">
								{profile?.avatarUrl ? (
									<img
										src={profile.avatarUrl}
										alt={displayName}
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
									<span className="font-mono text-[8px] text-primary/60 bg-primary/8 px-1.5 py-0.5 border border-primary/15 rounded flex-shrink-0">
										✓
									</span>
								</div>
								{profile?.username && (
									<p className="font-mono text-[11px] text-primary/60 mb-0.5">@{profile.username}</p>
								)}
								<p className="text-on-surface-variant font-mono text-[10px]">
									Member since {memberYear}
								</p>
							</div>
						</div>

						{/* Location */}
						{profile?.location && (
							<div className="flex items-center gap-1.5 font-mono text-xs text-on-surface-variant mb-3">
								<span className="material-symbols-outlined text-sm leading-none">location_on</span>
								{profile.location}
							</div>
						)}

						{/* Rank */}
						<RankCard
							title={rankTitle}
							globalRank={globalRank}
							rarityScore={rarityScore}
							contributionScore={contributionScore}
						/>
						<BadgeRow badges={userBadgeData} />

						{/* Trade reputation stat */}
						{tradeReputation.totalTrades > 0 && (
							<div className="font-mono text-[10px] text-on-surface-variant mt-2">
								TRADES: <span className="text-primary">{tradeReputation.totalTrades}</span>
								{" . "}
								AVG: <span className="text-secondary">{tradeReputation.averageRating?.toFixed(1) ?? "N/A"}</span>
								{" "}
								<span className="material-symbols-outlined text-secondary text-[14px] align-middle">star</span>
							</div>
						)}

						{/* Divider */}
						<div className="border-t border-outline/10 my-4" />

						{/* Follow counts + Edit */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-3 font-mono text-[10px]">
								<FollowList userId={user.id} type="following" count={followCounts.followingCount} />
								<span className="text-outline">&middot;</span>
								<FollowList userId={user.id} type="followers" count={followCounts.followerCount} />
							</div>
							<ThemeSwitcher />
							<EditProfileModal
								initial={{
									displayName:   profile?.displayName  ?? displayName,
									username:      profile?.username     ?? "",
									location:      profile?.location     ?? "",
									bio:           profile?.bio          ?? "",
									youtubeUrl:    profile?.youtubeUrl    ?? "",
									instagramUrl:  profile?.instagramUrl  ?? "",
									soundcloudUrl: profile?.soundcloudUrl ?? "",
									discogsUrl:    profile?.discogsUrl    ?? "",
									beatportUrl:   profile?.beatportUrl   ?? "",
									avatarUrl:     profile?.avatarUrl     ?? null,
								}}
							/>
						</div>

						{/* Social links */}
						<SocialLinks
							youtube={profile?.youtubeUrl    ?? null}
							instagram={profile?.instagramUrl  ?? null}
							soundcloud={profile?.soundcloudUrl ?? null}
							discogs={profile?.discogsUrl    ?? null}
							beatport={profile?.beatportUrl   ?? null}
						/>

						{/* Bio */}
						{profile?.bio && (
							<div className="mt-3 rounded border border-outline/15 bg-black/40 px-3 py-2.5 max-h-[180px] overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.15) transparent" }}>
								<p className="font-mono text-[11px] text-on-surface-variant leading-relaxed break-words whitespace-pre-wrap">
									{profile.bio}
								</p>
							</div>
						)}
					</div>
					{/* Decorative dot grid */}
					<div
						className="absolute inset-0 opacity-5 pointer-events-none"
						style={{
							backgroundImage: "radial-gradient(#6fdd78 1px, transparent 1px)",
							backgroundSize: "20px 20px",
						}}
					/>
				</div>

				{/* Digging Activity */}
				<div className="md:col-span-8 bg-surface-container-low p-6 rounded-lg flex flex-col gap-5">
					<h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-tertiary">
						Digging Activity
					</h3>

					{/* Stats row */}
					<div className="grid grid-cols-2 gap-3">
						{/* 3 number stats grouped */}
						<div className="bg-surface-container-high rounded-lg border border-outline/[0.07] flex flex-col">
							<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant px-4 pt-3 flex items-center gap-1.5">
								<span className="material-symbols-outlined text-[13px] text-tertiary">calendar_month</span>
								Week Activity
							</p>
							<div className="flex divide-x divide-outline/[0.07] flex-1">
								{/* Weekly adds */}
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-primary">playlist_add</span>
									<p className="text-3xl font-bold font-heading text-primary leading-none">{weeklyAdds}</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">Added</p>
								</div>
								{/* Trades this week */}
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-tertiary">swap_horiz</span>
									<p className="text-3xl font-bold font-heading text-tertiary leading-none">{tradesThisWeek}</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">Trades</p>
								</div>
								{/* Tracks on wantlist */}
								<div className="flex-1 p-4 flex flex-col items-center justify-center gap-1 text-center">
									<span className="material-symbols-outlined text-base text-secondary">task_alt</span>
									<p className="text-3xl font-bold font-heading text-secondary leading-none">{wantlistCount}</p>
									<p className="font-mono text-[9px] uppercase tracking-widest text-outline">Finded</p>
								</div>
							</div>
						</div>

						{/* Top genres */}
						<div className="bg-surface-container-high rounded-lg p-4 border border-outline/[0.07]">
							<p className="font-mono text-[9px] uppercase tracking-[0.18em] text-on-surface-variant mb-2 flex items-center gap-1.5">
								<span className="material-symbols-outlined text-[13px] text-secondary">queue_music</span>
								Top Genres
							</p>
							{topGenres.length > 0 ? (
								<ol className="space-y-1.5">
									{topGenres.map((g, i) => (
										<li key={g.genre} className="flex items-center gap-2 min-w-0">
											<span className="font-mono text-[9px] text-outline w-2.5 flex-shrink-0">{i + 1}</span>
											<span className="font-mono text-[11px] text-on-surface truncate flex-1">{g.genre}</span>
											<span className="font-mono text-[10px] text-secondary flex-shrink-0">{g.count}</span>
										</li>
									))}
								</ol>
							) : (
								<p className="font-mono text-[10px] text-outline/60 italic">no data yet</p>
							)}
						</div>
					</div>

					{/* Showcase */}
					<ShowcaseCards
						searching={showcaseSearching}
						rarest={showcaseRarest}
						favorite={showcaseFavorite}
						isOwner={true}
					/>
				</div>
			</section>

			{/* Stats Row */}
			<section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
				{[
					{ label: "RECORDS", value: collectionCount.toLocaleString(), color: "text-primary", icon: "album" },
					{ label: "RANK", value: globalRank ? `#${globalRank}` : "#--", color: "text-secondary", icon: "leaderboard" },
					{ label: "SCORE", value: globalScore.toFixed(1), color: "text-tertiary", icon: "score" },
					{ label: "TRADES", value: tradesTotal.toLocaleString(), color: "text-primary", icon: "swap_horiz" },
				].map((stat) => (
					<div
						key={stat.label}
						className="bg-surface-container-low p-4 rounded-lg border border-outline-variant/10"
					>
						<div className="flex items-center gap-2 mb-2">
							<span className={`material-symbols-outlined text-sm ${stat.color}`}>
								{stat.icon}
							</span>
							<span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">
								{stat.label}
							</span>
						</div>
						<div className={`text-2xl font-bold font-heading ${stat.color}`}>{stat.value}</div>
					</div>
				))}
			</section>

			{/* Wantlist */}
			<section className="mt-12">
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-secondary tracking-[0.2em] uppercase">
							Wantlist
						</span>
						<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
							Your_Wantlist
						</h2>
					</div>
					<WantlistAddButton />
				</div>

				<WantlistGrid items={wantlistData} isOwner={true} />

				{wantlistTotal > WANTLIST_PAGE_SIZE && (
					<p className="mt-4 text-center font-mono text-[10px] text-outline">
						Showing {Math.min(WANTLIST_PAGE_SIZE, wantlistTotal)} of {wantlistTotal} items
					</p>
				)}
			</section>

			{/* Collection Repository */}
			<section className="mt-12">
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Repository
						</span>
						<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
							Your_Collection
						</h2>
					</div>
					<AddRecordButton />
				</div>

				{/* Filter Bar */}
				<FilterBar
					genres={genres}
					formats={formats}
					currentFilters={filters}
					basePath="/perfil"
				/>

				{/* Collection Grid */}
				<CollectionGrid items={items} isOwner={true} />

				{/* Pagination */}
				{totalPages > 1 && (
					<Pagination
						currentPage={filters.page}
						totalPages={totalPages}
						baseUrl="/perfil"
						searchParams={rawSearchParams as Record<string, string>}
					/>
				)}
			</section>

		</div>
		</div>
	);
}
