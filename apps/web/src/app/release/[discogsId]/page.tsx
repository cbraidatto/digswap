import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getReleaseByDiscogsId } from "@/lib/release/queries";
import { getReviewsForRelease, getReviewCountForRelease } from "@/lib/community/queries";
import { ReleaseHero } from "./_components/release-hero";
import { ReleaseActions } from "./_components/release-actions";
import { YouTubeEmbed } from "./_components/youtube-embed";
import { OwnersSection } from "./_components/owners-section";
import { WhoHasItSection } from "./_components/who-has-it-section";
import { ReviewsSection } from "./_components/reviews-section";
import { TracklistSection } from "./_components/tracklist-section";

interface ReleasePageProps {
	params: Promise<{ discogsId: string }>;
}

export async function generateMetadata({ params }: ReleasePageProps): Promise<Metadata> {
	const { discogsId } = await params;
	const release = await getReleaseByDiscogsId(Number(discogsId));

	if (!release) {
		return { title: "Release Not Found - DigSwap" };
	}

	return {
		title: `${release.title} by ${release.artist} - DigSwap`,
		description: `${release.title} by ${release.artist}${release.year ? ` (${release.year})` : ""}. See who owns this release and read reviews on DigSwap.`,
		openGraph: {
			title: `${release.title} - ${release.artist}`,
			description: "Discover who has this record in their collection on DigSwap.",
			images: release.coverImageUrl
				? [{ url: release.coverImageUrl, width: 300, height: 300, alt: release.title }]
				: [],
			type: "music.album",
		},
	};
}

export default async function ReleasePage({ params }: ReleasePageProps) {
	const { discogsId } = await params;
	const release = await getReleaseByDiscogsId(Number(discogsId));

	if (!release) {
		notFound();
	}

	// Check auth state for YouTube search trigger
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	const isAuthenticated = !!user;

	// Pre-fetch reviews for initial render (limit 10 per plan spec)
	const [initialReviews, reviewCount] = await Promise.all([
		getReviewsForRelease(release.id, undefined, 10),
		getReviewCountForRelease(release.id),
	]);

	return (
		<div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
			<span className="font-mono text-xs text-primary tracking-[0.2em]">RELEASE_PAGE</span>

			<ReleaseHero
				release={{
					title: release.title,
					artist: release.artist,
					year: release.year,
					genre: release.genre,
					style: release.style,
					format: release.format,
					label: release.label,
					country: release.country,
					coverImageUrl: release.coverImageUrl,
					discogsId: release.discogsId,
					rarityScore: release.rarityScore,
					discogsHave: release.discogsHave,
					discogsWant: release.discogsWant,
				}}
			/>

			{isAuthenticated && (
				<ReleaseActions
					releaseId={release.id}
					discogsId={release.discogsId}
					title={release.title}
					artist={release.artist}
					coverImageUrl={release.coverImageUrl ?? null}
				/>
			)}

			<TracklistSection tracklist={release.tracklist} />

			<YouTubeEmbed
				videoId={release.youtubeVideoId}
				releaseId={release.id}
				isAuthenticated={isAuthenticated}
			/>

			<OwnersSection releaseId={release.id} />

			{release.discogsId && (
				<WhoHasItSection discogsId={release.discogsId} />
			)}

			<ReviewsSection
				releaseId={release.id}
				initialReviews={initialReviews}
				initialCount={reviewCount}
			/>
		</div>
	);
}
