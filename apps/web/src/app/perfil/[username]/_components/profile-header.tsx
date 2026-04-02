import Link from "next/link";
import Image from "next/image";
import type { UserRanking, UserBadge } from "@/lib/gamification/queries";
import { TrustStrip } from "@/components/trust/trust-strip";
import { FollowButton } from "./follow-button";
import { PremiumBadge } from "@/components/ui/PremiumBadge";

interface ProfileHeaderProps {
	profile: {
		id: string;
		displayName: string | null;
		username: string | null;
		avatarUrl: string | null;
		bio: string | null;
		createdAt: Date;
		subscriptionTier?: string;
	};
	followCounts: { followingCount: number; followerCount: number };
	isFollowing: boolean;
	collectionCount: number;
	ranking: UserRanking | null;
	badges: UserBadge[];
	isAuthenticated?: boolean;
}

export function ProfileHeader({
	profile,
	followCounts,
	isFollowing,
	collectionCount,
	ranking,
	badges,
	isAuthenticated = true,
}: ProfileHeaderProps) {
	const displayName = (profile.displayName || "DIGGER").toUpperCase();
	const isPremium =
		profile.subscriptionTier === "premium_monthly" ||
		profile.subscriptionTier === "premium_annual";
	const memberYear = new Date(profile.createdAt).getFullYear();

	return (
		<div className="bg-surface-container-low p-6 rounded-lg mb-8">
			<div className="flex flex-col sm:flex-row gap-6">
				{/* Avatar */}
				<div className="w-20 h-20 bg-surface-container-high rounded border-2 border-primary/20 flex items-center justify-center flex-shrink-0">
					{profile.avatarUrl ? (
						<Image
							src={profile.avatarUrl}
							alt={displayName}
							width={80}
							height={80}
							unoptimized
							className="w-full h-full object-cover rounded"
						/>
					) : (
						<span className="text-3xl font-mono font-bold text-primary">
							{displayName.charAt(0).toUpperCase()}
						</span>
					)}
				</div>

				{/* Info Section */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h1 className="text-3xl font-bold tracking-tight font-heading text-on-surface">
							{displayName}
						</h1>
						{isPremium && <PremiumBadge />}
					</div>
					{profile.username && (
						<p className="text-sm font-mono text-on-surface-variant">
							@{profile.username}
						</p>
					)}
					{/* Rank + Badges */}
					<p className="font-mono text-xs mt-1 flex flex-wrap items-center gap-1.5">
						<span className="text-secondary">{ranking?.title ?? "Vinyl Rookie"}</span>
						<span className="text-outline">&middot;</span>
						<span className="text-on-surface-variant">
							{ranking?.globalRank ? `#${ranking.globalRank} globally` : "unranked"}
						</span>
						{badges.length > 0 && (
							<>
								<span className="text-outline">&middot;</span>
								{badges.map((b) => (
									<span
										key={b.slug}
										className="text-primary/80 bg-primary/8 border border-primary/15 px-1.5 py-0.5 rounded"
										title={b.description ?? undefined}
									>
										[{b.name}]
									</span>
								))}
							</>
						)}
					</p>
					{/* TrustStrip — replaces single-line trade stat */}
					<div className="mt-1">
						<TrustStrip userId={profile.id} variant="compact" />
					</div>

					{profile.bio && (
						<p className="text-sm text-on-surface-variant mt-1 max-w-md">
							{profile.bio}
						</p>
					)}
					<p className="text-xs font-mono text-on-surface-variant mt-2">
						Member since {memberYear} / Vinyl Network
					</p>

					{/* Counts */}
					<div className="flex items-center gap-4 mt-4 font-mono text-xs">
						<span>
							<span className="text-secondary">{followCounts.followingCount}</span>{" "}
							<span className="text-on-surface-variant">following</span>
						</span>
						<span className="text-outline">&middot;</span>
						<span>
							<span className="text-secondary">{followCounts.followerCount}</span>{" "}
							<span className="text-on-surface-variant">followers</span>
						</span>
					</div>

					{/* Buttons — only for authenticated users */}
					{isAuthenticated && (
						<div className="flex items-center gap-3 mt-4">
							<FollowButton
								targetUserId={profile.id}
								targetUsername={profile.username || "user"}
								initialIsFollowing={isFollowing}
								initialFollowerCount={followCounts.followerCount}
							/>
							<Link
								href={`/perfil/${profile.username}/compare`}
								className="inline-flex items-center gap-2 border border-outline-variant text-on-surface-variant bg-transparent hover:bg-surface-container-high font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors h-11 md:h-8"
							>
								<span className="material-symbols-outlined text-[16px]">
									compare_arrows
								</span>
								COMPARE COLLECTION
							</Link>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
