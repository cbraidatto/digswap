import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { collectionFilterSchema } from "@/lib/collection/filters";
import {
	getCollectionCount,
	getCollectionPage,
	getUniqueFormats,
	getUniqueGenres,
	PAGE_SIZE,
} from "@/lib/collection/queries";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema/users";
import { getUserBadges, getUserRanking } from "@/lib/gamification/queries";
import { checkIsFollowing, getFollowCounts } from "@/lib/social/queries";
import { createClient } from "@/lib/supabase/server";
import {
	getCompatibilityScore,
	getWantlistIntersections,
} from "@/lib/wantlist/intersection-queries";
import { ProfileCollectionSection } from "./_components/profile-collection-section";
import { ProfileHeader } from "./_components/profile-header";

interface PublicProfileProps {
	params: Promise<{ username: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PublicProfileProps): Promise<Metadata> {
	const { username } = await params;
	return {
		title: `${username} — DigSwap`,
		description: `Check out ${username}'s vinyl collection on DigSwap.`,
	};
}

export default async function PublicProfilePage({ params, searchParams }: PublicProfileProps) {
	const { username } = await params;

	// Optional auth — no redirect on null
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Lookup target profile
	// NOTE (M-15): 404 vs 200 enables username enumeration — accepted tradeoff for a
	// social network where profiles are public by design. Rate limiting for this route
	// is applied at the middleware layer (protectedPaths excludes /perfil/[username])
	// but Upstash-based IP rate limiting should be added in middleware when Redis is
	// configured. See security audit M-15.
	const [targetProfile] = await db
		.select({
			id: profiles.id,
			displayName: profiles.displayName,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			bio: profiles.bio,
			createdAt: profiles.createdAt,
			subscriptionTier: profiles.subscriptionTier,
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
	const [items, totalCount, genres, formats, followCounts, isFollowing, ranking, userBadgeData] =
		await Promise.all([
			getCollectionPage(targetProfile.id, filters),
			getCollectionCount(targetProfile.id, filters),
			getUniqueGenres(targetProfile.id),
			getUniqueFormats(targetProfile.id),
			getFollowCounts(targetProfile.id),
			user ? checkIsFollowing(user.id, targetProfile.id) : Promise.resolve(false),
			getUserRanking(targetProfile.id),
			getUserBadges(targetProfile.id),
		]);

	const totalPages = Math.ceil(totalCount / PAGE_SIZE);

	// Wantlist intersections + compatibility — only for logged-in visitors
	const [intersections, compatibility] = await Promise.all([
		user ? getWantlistIntersections(user.id, targetProfile.id) : Promise.resolve([]),
		user
			? getCompatibilityScore(user.id, targetProfile.id)
			: Promise.resolve({ sharedRecords: 0, wantlistMatches: 0 }),
	]);

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Visitor CTA */}
			{!user && (
				<div className="mb-6 p-4 bg-surface-container-low border border-outline-variant/20 rounded font-mono text-xs">
					<span className="text-tertiary">[VISITOR]</span>
					<span className="text-on-surface-variant"> // </span>
					<span className="text-on-surface">
						Create an account to follow this digger and initiate trades.
					</span>
					<Link href="/signup" className="ml-3 text-primary hover:underline">
						Start digging &rarr;
					</Link>
				</div>
			)}

			{/* Profile Header */}
			<ProfileHeader
				profile={{ ...targetProfile, subscriptionTier: targetProfile.subscriptionTier ?? "free" }}
				followCounts={followCounts}
				isFollowing={isFollowing}
				collectionCount={totalCount}
				ranking={ranking}
				badges={userBadgeData}
				isAuthenticated={!!user}
			/>

			{/* Compatibility score — logged-in visitors */}
			{user && (compatibility.sharedRecords > 0 || compatibility.wantlistMatches > 0) && (
				<div className="mb-6 flex items-center gap-4 bg-surface-container-low/50 rounded-xl px-4 py-3 border border-outline-variant/5">
					<span className="material-symbols-outlined text-[18px] text-secondary">
						compare_arrows
					</span>
					<div className="flex items-center gap-3 font-mono text-xs">
						{compatibility.sharedRecords > 0 && (
							<span>
								<span className="text-primary font-semibold">{compatibility.sharedRecords}</span>
								<span className="text-on-surface-variant/50 ml-1">records in common</span>
							</span>
						)}
						{compatibility.sharedRecords > 0 && compatibility.wantlistMatches > 0 && (
							<span className="text-outline-variant/20">·</span>
						)}
						{compatibility.wantlistMatches > 0 && (
							<span>
								<span className="text-secondary font-semibold">
									{compatibility.wantlistMatches}
								</span>
								<span className="text-on-surface-variant/50 ml-1">wantlist matches</span>
							</span>
						)}
					</div>
				</div>
			)}

			{/* Collection Section — client wrapper manages filter toggle state */}
			<ProfileCollectionSection
				items={items}
				intersections={intersections}
				genres={genres}
				formats={formats}
				currentFilters={filters}
				totalPages={totalPages}
				username={username}
				searchParams={rawParams as Record<string, string>}
			/>
		</div>
	);
}
