import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { createClient } from "@/lib/supabase/server";
import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionPage,
	getCollectionCount,
	getUniqueGenres,
	getUniqueFormats,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { getFollowCounts, checkIsFollowing } from "@/lib/social/queries";
import { getUserRanking, getUserBadges } from "@/lib/gamification/queries";
import { isP2PEnabled } from "@/lib/trades/constants";
import { getTradeReputation } from "@/lib/trades/queries";
import { CollectionGrid } from "../_components/collection-grid";
import { RequestAudioButton } from "../_components/request-audio-button";
import { FilterBar } from "../_components/filter-bar";
import { Pagination } from "../_components/pagination";
import { ProfileHeader } from "./_components/profile-header";

interface PublicProfileProps {
	params: Promise<{ username: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicProfilePage({
	params,
	searchParams,
}: PublicProfileProps) {
	const { username } = await params;

	// Auth check
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) redirect("/signin");

	// Lookup target profile
	const [targetProfile] = await db
		.select({
			id: profiles.id,
			displayName: profiles.displayName,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			bio: profiles.bio,
			createdAt: profiles.createdAt,
		})
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	if (!targetProfile) notFound();

	// Self-redirect: if viewing own profile, go to /perfil
	if (user.id === targetProfile.id) redirect("/perfil");

	// Parse filters from search params
	const rawParams = await searchParams;
	const filters = collectionFilterSchema.parse(rawParams);

	// Parallel data fetch
	const [items, totalCount, genres, formats, followCounts, isFollowing, ranking, userBadgeData, tradeReputation] =
		await Promise.all([
			getCollectionPage(targetProfile.id, filters),
			getCollectionCount(targetProfile.id, filters),
			getUniqueGenres(targetProfile.id),
			getUniqueFormats(targetProfile.id),
			getFollowCounts(targetProfile.id),
			checkIsFollowing(user.id, targetProfile.id),
			getUserRanking(targetProfile.id),
			getUserBadges(targetProfile.id),
			getTradeReputation(targetProfile.id),
		]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);
	const p2pEnabled = isP2PEnabled();

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Profile Header */}
			<ProfileHeader
				profile={targetProfile}
				followCounts={followCounts}
				isFollowing={isFollowing}
				collectionCount={totalCount}
				ranking={ranking}
				badges={userBadgeData}
				tradeReputation={tradeReputation}
			/>

			{/* Collection Section */}
			<section>
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Repository
						</span>
						<h2 className="text-2xl font-bold font-heading text-on-surface mt-1">
							{(targetProfile.displayName || "Digger").replace(/\s+/g, "_")}
							&apos;s_Collection
						</h2>
					</div>
				</div>

				{/* Filter Bar */}
				<FilterBar
					genres={genres}
					formats={formats}
					currentFilters={filters}
					basePath={`/perfil/${username}`}
				/>

				{/* Collection Grid */}
				<CollectionGrid
					items={items}
					isOwner={false}
					renderAction={(item) => (
						<RequestAudioButton
							userId={targetProfile.id}
							releaseId={item.releaseId}
							p2pEnabled={p2pEnabled}
							isOwner={false}
						/>
					)}
				/>

				{/* Pagination */}
				{totalPages > 1 && (
					<Pagination
						currentPage={filters.page}
						totalPages={totalPages}
						baseUrl={`/perfil/${username}`}
						searchParams={rawParams as Record<string, string>}
					/>
				)}
			</section>
		</div>
	);
}
