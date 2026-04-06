import Image from "next/image";
import Link from "next/link";
import { EditProfileModal } from "./edit-profile-modal";
import { SocialLinks } from "./social-links";
import { ShareSurface } from "@/components/share/share-surface";
import { PremiumBadge } from "@/components/ui/PremiumBadge";
import type { UserBadge } from "@/lib/gamification/queries";

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
	};
	badges: UserBadge[];
	isOwner: boolean;
}

export function ProfileHero({ profile, stats, badges, isOwner }: ProfileHeroProps) {
	const displayName = profile.displayName || "DIGGER";
	const isPremium = profile.subscriptionTier === "premium_monthly" || profile.subscriptionTier === "premium_annual";
	const coverY = Number(profile.coverPositionY ?? 50);

	return (
		<div className="relative mb-8">
			{/* Cover image / fallback gradient */}
			<div className="h-40 md:h-52 rounded-xl overflow-hidden relative">
				{profile.coverUrl ? (
					<Image
						src={profile.coverUrl}
						alt="Cover"
						fill
						className="object-cover"
						style={{ objectPosition: `center ${coverY}%` }}
						priority
					/>
				) : (
					<div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface-container-high to-secondary/10" />
				)}
				{/* Gradient overlay for text readability */}
				<div className="absolute inset-0 bg-gradient-to-t from-surface-dim via-surface-dim/60 to-transparent" />
			</div>

			{/* Profile info — overlaps the cover */}
			<div className="relative -mt-16 px-4 md:px-6">
				<div className="flex items-end gap-4 md:gap-5">
					{/* Avatar with glow */}
					<div className="relative flex-shrink-0">
						<div className="w-24 h-24 md:w-28 md:h-28 rounded-xl border-4 border-surface-dim overflow-hidden bg-surface-container-high shadow-lg shadow-primary/10">
							{profile.avatarUrl ? (
								<Image
									src={profile.avatarUrl}
									alt={displayName}
									width={112}
									height={112}
									unoptimized
									className="w-full h-full object-cover"
								/>
							) : (
								<div className="w-full h-full flex items-center justify-center">
									<span className="text-3xl font-heading font-bold text-primary">
										{displayName.charAt(0).toUpperCase()}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Name + meta */}
					<div className="flex-1 min-w-0 pb-1">
						<div className="flex items-center gap-2 flex-wrap">
							<h1 className="font-heading text-xl md:text-2xl font-extrabold text-on-surface leading-tight truncate">
								{displayName}
							</h1>
							{isPremium && <PremiumBadge />}
							{stats.globalRank && (
								<span className="font-mono text-[10px] text-secondary bg-secondary/10 border border-secondary/20 px-1.5 py-0.5 rounded-full">
									#{stats.globalRank}
								</span>
							)}
						</div>
						{profile.username && (
							<p className="font-mono text-xs text-on-surface-variant/60 mt-0.5">
								@{profile.username}
								{profile.location && (
									<span className="text-on-surface-variant/40"> · {profile.location}</span>
								)}
							</p>
						)}
					</div>
				</div>

				{/* Stats + actions row */}
				<div className="mt-4 flex items-center justify-between flex-wrap gap-3">
					{/* Stats inline */}
					<div className="flex items-center gap-4 font-mono text-xs">
						<span>
							<span className="text-on-surface font-semibold">{stats.collectionCount}</span>
							<span className="text-on-surface-variant/50 ml-1">records</span>
						</span>
						<span className="text-outline-variant/20">·</span>
						<span>
							<span className="text-on-surface font-semibold">{stats.followerCount}</span>
							<span className="text-on-surface-variant/50 ml-1">followers</span>
						</span>
						<span className="text-outline-variant/20">·</span>
						<span>
							<span className="text-on-surface font-semibold">{stats.followingCount}</span>
							<span className="text-on-surface-variant/50 ml-1">following</span>
						</span>
					</div>

					{/* Actions */}
					{isOwner && (
						<div className="flex items-center gap-2">
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
							<ShareSurface
								url={`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/perfil/${profile.username}`}
								label="Share"
							/>
						</div>
					)}
				</div>

				{/* Bio */}
				{profile.bio && (
					<p className="mt-3 font-mono text-xs text-on-surface-variant/70 leading-relaxed max-w-lg">
						{profile.bio}
					</p>
				)}

				{/* Social links + badges — compact row */}
				<div className="mt-3 flex items-center gap-3 flex-wrap">
					<SocialLinks
						youtube={profile.youtubeUrl}
						instagram={profile.instagramUrl}
						soundcloud={profile.soundcloudUrl}
						discogs={profile.discogsUrl}
						beatport={profile.beatportUrl}
					/>
					{badges.length > 0 && (
						<div className="flex items-center gap-1">
							{badges.slice(0, 4).map((b) => (
								<span
									key={b.slug}
									className="font-mono text-[9px] text-primary/70 bg-primary/8 border border-primary/12 px-1.5 py-0.5 rounded"
									title={b.description ?? undefined}
								>
									{b.name}
								</span>
							))}
							{badges.length > 4 && (
								<span className="font-mono text-[9px] text-on-surface-variant/40">
									+{badges.length - 4}
								</span>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
