import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
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
import { CollectionGrid } from "../../(protected)/(profile)/perfil/_components/collection-grid";
import { RequestAudioButton } from "../../(protected)/(profile)/perfil/_components/request-audio-button";
import { FilterBar } from "../../(protected)/(profile)/perfil/_components/filter-bar";
import { Pagination } from "../../(protected)/(profile)/perfil/_components/pagination";
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

	// Optional auth — no redirect on null
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

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

	// Self-redirect: if viewing own profile while logged in, go to /perfil
	if (user && user.id === targetProfile.id) redirect("/perfil");

	// Parse filters from search params
	const rawParams = await searchParams;
	const filters = collectionFilterSchema.parse(rawParams);

	// Parallel data fetch — isFollowing only when authenticated
	const [items, totalCount, genres, formats, followCounts, isFollowing, ranking, userBadgeData, tradeReputation] =
		await Promise.all([
			getCollectionPage(targetProfile.id, filters),
			getCollectionCount(targetProfile.id, filters),
			getUniqueGenres(targetProfile.id),
			getUniqueFormats(targetProfile.id),
			getFollowCounts(targetProfile.id),
			user ? checkIsFollowing(user.id, targetProfile.id) : Promise.resolve(false),
			getUserRanking(targetProfile.id),
			getUserBadges(targetProfile.id),
			getTradeReputation(targetProfile.id),
		]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);
	const p2pEnabled = isP2PEnabled();

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Visitor CTA */}
			{!user && (
				<div className="mb-6 p-4 bg-surface-container-low border border-outline-variant/20 rounded font-mono text-[11px]">
					<span className="text-tertiary">[VISITOR]</span>
					<span className="text-on-surface-variant">{" "}// </span>
					<span className="text-on-surface">Create an account to follow this digger and initiate trades.</span>
					<Link href="/signup" className="ml-3 text-primary hover:underline">START_DIGGING &rarr;</Link>
				</div>
			)}

			{/* Profile Header */}
			<ProfileHeader
				profile={targetProfile}
				followCounts={followCounts}
				isFollowing={isFollowing}
				collectionCount={totalCount}
				ranking={ranking}
				badges={userBadgeData}
				tradeReputation={tradeReputation}
				isAuthenticated={!!user}
			/>

			{/* Collection Section */}
			<section>
				<div className="flex items-center justify-between mb-6">
					<div>
						<span className="text-[10px] font-mono text-primary tracking-[0.2em] uppercase">
							Collection
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
					renderAction={user ? (item) => (
						<RequestAudioButton
							userId={targetProfile.id}
							releaseId={item.releaseId}
							p2pEnabled={p2pEnabled}
							isOwner={false}
						/>
					) : undefined}
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
