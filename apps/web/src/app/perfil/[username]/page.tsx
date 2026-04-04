import type { Metadata } from "next";
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
import { getWantlistIntersections } from "@/lib/wantlist/intersection-queries";
import { ProfileHeader } from "./_components/profile-header";
import { ProfileCollectionSection } from "./_components/profile-collection-section";

interface PublicProfileProps {
	params: Promise<{ username: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
	params,
}: PublicProfileProps): Promise<Metadata> {
	const { username } = await params;
	return {
		title: `${username} — DigSwap`,
		description: `Check out ${username}'s vinyl collection on DigSwap.`,
	};
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

	// Wantlist intersections — only for logged-in visitors viewing someone else's profile
	const intersections = user
		? await getWantlistIntersections(user.id, targetProfile.id)
		: [];

	return (
		<div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
			{/* Visitor CTA */}
			{!user && (
				<div className="mb-6 p-4 bg-surface-container-low border border-outline-variant/20 rounded font-mono text-xs">
					<span className="text-tertiary">[VISITOR]</span>
					<span className="text-on-surface-variant">{" "}// </span>
					<span className="text-on-surface">Create an account to follow this digger and initiate trades.</span>
					<Link href="/signup" className="ml-3 text-primary hover:underline">Start digging &rarr;</Link>
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
