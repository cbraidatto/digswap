import { and, count, eq, gte, inArray, isNotNull, isNull, or } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
	title: "My Profile — DigSwap",
	description: "View and manage your vinyl record collection.",
};

import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionCount,
	getCollectionPage,
	getTopGenres,
	getUniqueFormats,
	getUniqueGenres,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { db } from "@/lib/db";
import { collectionItems } from "@/lib/db/schema/collections";
import { releases } from "@/lib/db/schema/releases";
import { tradeRequests } from "@/lib/db/schema/trades";
import { profiles } from "@/lib/db/schema/users";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { getUserBadges, getUserRanking } from "@/lib/gamification/queries";
import { getGemDistribution, getGemScoreForUser } from "@/lib/gems/queries";
import { getFollowCounts } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import { getWantlistPage, getWantlistTotalCount, WANTLIST_PAGE_SIZE } from "@/lib/wantlist/queries";
import { AboutTab } from "./_components/about-tab";
import { AddRecordButton } from "./_components/add-record-button";
import { CollectionSectionClient } from "./_components/collection-section-client";
import { CoverBanner } from "./_components/cover-banner";
import { EditProfileModal } from "./_components/edit-profile-modal";
import { ExportCollectionButton } from "./_components/export-collection-button";
import { FilterBar } from "./_components/filter-bar";
import { Pagination } from "./_components/pagination";
// Components
import { ProfileSidebar } from "./_components/profile-sidebar";
import { type ProfileTab, ProfileTabs } from "./_components/profile-tabs";
import { ShareProfileButton } from "./_components/share-profile-button";
import { TradingTab } from "./_components/trading-tab";
import { WantlistTab } from "./_components/wantlist-tab";

interface PerfilPageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PerfilPage({ searchParams }: PerfilPageProps) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin");

	const rawSearchParams = await searchParams;
	const filters = collectionFilterSchema.parse(rawSearchParams);
	const activeTab = (rawSearchParams.tab as ProfileTab) || "collection";

	// Fetch profile
	const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

	if (!profile) redirect("/onboarding");

	const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	// Showcase release IDs
	const showcaseIds = [
		profile.showcaseSearchingId,
		profile.showcaseRarestId,
		profile.showcaseFavoriteId,
	].filter((id): id is string => Boolean(id));

	// Parallel data fetch
	const [
		items,
		totalCount,
		genres,
		formats,
		followCounts,
		topGenres,
		showcaseReleases,
		wantlistData,
		wantlistTotal,
		ranking,
		userBadgeData,
		[{ tradesTotal }],
		[{ activeTradeCount }],
		gemDistribution,
		gemScore,
		[{ weeklyAdds }],
		[{ tradesThisWeek }],
		[{ wantlistFound }],
	] = await Promise.all([
		getCollectionPage(user.id, filters),
		getCollectionCount(user.id, filters),
		getUniqueGenres(user.id),
		getUniqueFormats(user.id),
		getFollowCounts(user.id),
		getTopGenres(user.id),
		showcaseIds.length > 0
			? db
					.select({
						id: releases.id,
						discogsId: releases.discogsId,
						title: releases.title,
						artist: releases.artist,
						year: releases.year,
						coverImageUrl: releases.coverImageUrl,
					})
					.from(releases)
					.where(inArray(releases.id, showcaseIds))
			: Promise.resolve([]),
		getWantlistPage(user.id, 1),
		getWantlistTotalCount(user.id),
		getUserRanking(user.id),
		getUserBadges(user.id),
		db
			.select({ tradesTotal: count() })
			.from(tradeRequests)
			.where(or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id))),
		db
			.select({ activeTradeCount: count() })
			.from(tradeRequests)
			.where(
				and(
					or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id)),
					eq(tradeRequests.status, "pending"),
				),
			),
		getGemDistribution(user.id),
		getGemScoreForUser(user.id),
		db
			.select({ weeklyAdds: count() })
			.from(collectionItems)
			.where(
				and(
					eq(collectionItems.userId, user.id),
					isNull(collectionItems.deletedAt),
					gte(collectionItems.createdAt, weekAgo),
				),
			),
		db
			.select({ tradesThisWeek: count() })
			.from(tradeRequests)
			.where(
				and(
					or(eq(tradeRequests.requesterId, user.id), eq(tradeRequests.providerId, user.id)),
					gte(tradeRequests.createdAt, weekAgo),
				),
			),
		db
			.select({ wantlistFound: count() })
			.from(wantlistItems)
			.where(and(eq(wantlistItems.userId, user.id), isNotNull(wantlistItems.foundAt))),
	]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);
	const releaseById = Object.fromEntries(showcaseReleases.map((r) => [r.id, r]));
	const showcaseSearching = profile.showcaseSearchingId
		? (releaseById[profile.showcaseSearchingId] ?? null)
		: null;
	const showcaseRarest = profile.showcaseRarestId
		? (releaseById[profile.showcaseRarestId] ?? null)
		: null;
	const showcaseFavorite = profile.showcaseFavoriteId
		? (releaseById[profile.showcaseFavoriteId] ?? null)
		: null;

	// Tradeable items (for Trading tab) — uses visibility field
	const tradeableItems = items.filter((i) => i.visibility === "tradeable");

	// Heatmap data — count records added per day (last 140 days)
	const heatmapData: Record<string, number> = {};
	for (const item of items) {
		const key = item.createdAt.toISOString().split("T")[0];
		heatmapData[key] = (heatmapData[key] ?? 0) + 1;
	}

	// Recently added — last 10 records sorted by date
	const recentlyAdded = [...items]
		.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
		.slice(0, 10)
		.map((i) => ({
			title: i.title,
			artist: i.artist,
			createdAt: i.createdAt.toISOString(),
			discogsId: i.discogsId,
		}));

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
			{/* Compact Cover Banner */}
			<CoverBanner
				initialCoverUrl={profile.coverUrl}
				initialPositionY={Number(profile.coverPositionY ?? 50)}
				isOwner={true}
			/>

			{/* Two-column layout: Content + Sidebar */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
				{/* Main content — left */}
				<main className="lg:col-span-7 xl:col-span-8 min-w-0">
					<ProfileTabs
						activeTab={activeTab}
						collectionCount={totalCount}
						wantlistCount={wantlistTotal}
						tradeCount={tradeableItems.length}
						actionButtons={
							<>
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
								<ShareProfileButton username={profile.username} />
							</>
						}
					>
						{{
							/* ── Collection Tab ── */
							collection: (
								<div>
									<div className="flex items-center justify-between mb-4">
										<h2 className="font-heading text-lg font-bold text-on-surface">Collection</h2>
										<div className="flex items-center gap-2">
											<ExportCollectionButton />
											<AddRecordButton />
										</div>
									</div>
									<FilterBar
										genres={genres}
										formats={formats}
										currentFilters={filters}
										basePath="/perfil"
									/>
									<CollectionSectionClient items={items} />
									{totalPages > 1 && (
										<Pagination
											currentPage={filters.page}
											totalPages={totalPages}
											baseUrl="/perfil"
											searchParams={rawSearchParams as Record<string, string>}
										/>
									)}
								</div>
							),

							/* ── Wantlist Tab ── */
							wantlist: (
								<WantlistTab
									items={wantlistData}
									total={wantlistTotal}
									pageSize={WANTLIST_PAGE_SIZE}
									isOwner={true}
								/>
							),

							/* ── Trading Tab ── */
							trading: (
								<TradingTab tradeableItems={tradeableItems} activeTradeCount={activeTradeCount} />
							),

							/* ── About Tab ── */
							about: (
								<AboutTab
									userId={user.id}
									profile={{
										username: profile.username,
										displayName: profile.displayName,
										holyGrailIds: profile.holyGrailIds as string[] | null,
									}}
									stats={{
										collectionCount: totalCount,
										globalRank: ranking?.globalRank ?? null,
										rankTitle: ranking?.title ?? "Vinyl Rookie",
										gemScore: ranking?.gemScore ?? 0,
										contributionScore: ranking?.contributionScore ?? 0,
										totalTrades: tradesTotal,
									}}
									wantlistItems={wantlistData.map((item) => ({
										id: item.id,
										releaseTitle: item.title ?? null,
										releaseArtist: item.artist ?? null,
									}))}
									topGenres={topGenres}
									badges={userBadgeData}
									gemDistribution={gemDistribution}
									totalGemScore={gemScore}
									heatmapData={heatmapData}
									recentlyAdded={recentlyAdded}
									isOwner={true}
								/>
							),
						}}
					</ProfileTabs>
				</main>

				{/* Sidebar — right */}
				<div className="lg:col-span-5 xl:col-span-4 min-w-0">
					<div className="lg:sticky lg:top-20">
						<ProfileSidebar
							profile={{
								id: user.id,
								displayName: profile.displayName,
								username: profile.username,
								avatarUrl: profile.avatarUrl,
								bio: profile.bio,
								location: profile.location,
								subscriptionTier: profile.subscriptionTier,
								youtubeUrl: profile.youtubeUrl,
								instagramUrl: profile.instagramUrl,
								soundcloudUrl: profile.soundcloudUrl,
								discogsUrl: profile.discogsUrl,
								beatportUrl: profile.beatportUrl,
							}}
							stats={{
								collectionCount: totalCount,
								followingCount: followCounts.followingCount,
								followerCount: followCounts.followerCount,
								globalRank: ranking?.globalRank ?? null,
								rankTitle: ranking?.title ?? "Vinyl Rookie",
								gemScore: ranking?.gemScore ?? 0,
								contributionScore: ranking?.contributionScore ?? 0,
							}}
							showcase={{
								searching: showcaseSearching,
								rarest: showcaseRarest,
								favorite: showcaseFavorite,
							}}
							badges={userBadgeData}
							isOwner={true}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
