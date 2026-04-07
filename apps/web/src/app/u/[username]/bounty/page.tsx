import { eq, inArray } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareSurface } from "@/components/share/share-surface";
import { CoverArt } from "@/components/ui/cover-art";
import { db } from "@/lib/db";
import { releases } from "@/lib/db/schema/releases";
import { profiles } from "@/lib/db/schema/users";
import { wantlistItems } from "@/lib/db/schema/wantlist";
import { createClient } from "@/lib/supabase/server";

interface BountyPageProps {
	params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: BountyPageProps) {
	const { username } = await params;
	return {
		title: `${username}'s Holy Grails - DigSwap`,
		description: `${username} is hunting these records. If you have them, connect on DigSwap.`,
	};
}

export default async function BountyPage({ params }: BountyPageProps) {
	const { username } = await params;

	// Optional auth -- logged-in users get a different CTA
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	// Fetch target profile
	const [targetProfile] = await db
		.select({
			id: profiles.id,
			displayName: profiles.displayName,
			username: profiles.username,
			avatarUrl: profiles.avatarUrl,
			holyGrailIds: profiles.holyGrailIds,
		})
		.from(profiles)
		.where(eq(profiles.username, username))
		.limit(1);

	if (!targetProfile) notFound();

	const holyGrailIds = (targetProfile.holyGrailIds as string[] | null) ?? [];

	// Fetch Holy Grail wantlist items with release data
	const grailItems =
		holyGrailIds.length > 0
			? await db
					.select({
						id: wantlistItems.id,
						releaseTitle: releases.title,
						releaseArtist: releases.artist,
						rarityScore: releases.rarityScore,
						coverImageUrl: releases.coverImageUrl,
					})
					.from(wantlistItems)
					.innerJoin(releases, eq(wantlistItems.releaseId, releases.id))
					.where(inArray(wantlistItems.id, holyGrailIds.slice(0, 3)))
			: [];

	const bountyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/u/${username}/bounty`;

	function getRarityLabel(score: number | null): {
		label: string;
		colorClass: string;
	} {
		if (!score) return { label: "COMMON", colorClass: "text-on-surface-variant" };
		if (score >= 80) return { label: "ULTRA_RARE", colorClass: "text-tertiary" };
		if (score >= 50) return { label: "RARE", colorClass: "text-secondary" };
		return { label: "COMMON", colorClass: "text-primary" };
	}

	return (
		<div className="min-h-screen bg-background p-6">
			{/* Background dot grid */}
			<div
				className="fixed inset-0 opacity-[0.03] pointer-events-none"
				style={{
					backgroundImage: "radial-gradient(var(--primary) 1px, transparent 1px)",
					backgroundSize: "32px 32px",
				}}
			/>

			<div className="relative z-10 max-w-lg mx-auto">
				{/* Header */}
				<div className="mb-8 text-center">
					<div className="font-mono text-xs text-primary tracking-[0.2em] mb-2">[BOUNTY_LINK]</div>
					<div className="flex items-center justify-center gap-3 mb-4">
						{targetProfile.avatarUrl ? (
							<Image
								src={targetProfile.avatarUrl}
								alt={targetProfile.displayName ?? username}
								width={48}
								height={48}
								unoptimized
								className="w-12 h-12 rounded-full"
							/>
						) : (
							<div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center">
								<span className="font-mono text-lg font-bold text-primary">
									{username.charAt(0).toUpperCase()}
								</span>
							</div>
						)}
						<div>
							<h1 className="font-heading text-2xl font-extrabold text-on-surface">
								{targetProfile.displayName ?? username}
							</h1>
							<p className="font-mono text-xs text-on-surface-variant">
								@{username} is hunting these records
							</p>
						</div>
					</div>
				</div>

				{/* Holy Grail records */}
				{grailItems.length === 0 ? (
					<div className="text-center font-mono text-xs text-on-surface-variant py-8">
						[NO_GRAILS_SET] // {username} hasn&apos;t selected their Holy Grails yet.
					</div>
				) : (
					<div className="space-y-4 mb-8">
						{grailItems.map((item, idx) => {
							const rarity = getRarityLabel(item.rarityScore);
							return (
								<div
									key={item.id}
									className="bg-surface-container-low border border-outline-variant/20 rounded overflow-hidden"
								>
									<div className="h-0.5 bg-primary" />
									<div className="p-4 flex items-start gap-4">
										{/* Cover art or placeholder */}
										<CoverArt
											src={item.coverImageUrl}
											alt={item.releaseTitle ?? ""}
											size="lg"
											width={64}
											height={64}
											containerClassName="w-16 h-16"
										/>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<span className="font-mono text-[9px] text-tertiary">
													[HOLY_GRAIL #{idx + 1}]
												</span>
												<span className={`font-mono text-[9px] ${rarity.colorClass}`}>
													[{rarity.label}]
												</span>
											</div>
											<div className="font-heading text-base font-bold text-on-surface">
												{item.releaseTitle ?? "Unknown Title"}
											</div>
											{item.releaseArtist && (
												<div className="font-mono text-xs text-on-surface-variant mt-0.5">
													{item.releaseArtist}
												</div>
											)}
										</div>
									</div>

									{/* CTA */}
									<div className="px-4 pb-4">
										{user ? (
											<Link
												href={`/perfil/${username}`}
												className="block w-full text-center font-mono text-xs bg-primary-container text-on-primary-container py-2 rounded hover:brightness-110 transition-all"
											>
												I HAVE THIS RECORD → CONNECT
											</Link>
										) : (
											<Link
												href={`/signup?ref=bounty&from=${username}`}
												className="block w-full text-center font-mono text-xs bg-primary-container text-on-primary-container py-2 rounded hover:brightness-110 transition-all"
											>
												CREATE ACCOUNT TO CONNECT →
											</Link>
										)}
									</div>
								</div>
							);
						})}
					</div>
				)}

				{/* Share this page */}
				<div className="text-center border-t border-outline-variant/10 pt-6">
					<ShareSurface url={bountyUrl} label="SHARE_THIS_BOUNTY" />
					<Link
						href="/signup"
						className="block mt-4 font-mono text-xs text-on-surface-variant hover:text-primary"
					>
						Join DigSwap - find who has YOUR Holy Grails →
					</Link>
				</div>
			</div>
		</div>
	);
}
