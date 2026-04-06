import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
	title: "Feed — DigSwap",
	description: "See the latest activity from the digger community.",
};
import {
	getProgressBarState,
	getFollowCounts,
	getGlobalFeed,
	getPersonalFeed,
} from "@/lib/social/queries";
import { getExploreFeed } from "@/lib/social/explore-queries";
import { FeedContainer } from "./_components/feed-container";
import { RadarSection } from "./_components/radar-section";
import { RadarEmptyState } from "./_components/radar-empty-state";
import { FeedWelcomeBanner } from "./_components/feed-welcome-banner";

export default async function FeedPage({
	searchParams,
}: {
	searchParams: Promise<{ tab?: string }>;
}) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/signin");
	}

	const { tab } = await searchParams;
	const isExplore = tab === "explore";

	const [progressState, followCounts] = await Promise.all([
		getProgressBarState(user.id),
		getFollowCounts(user.id),
	]);

	let initialItems;
	if (isExplore) {
		initialItems = await getExploreFeed(user.id, null, 20);
	} else {
		const initialMode =
			followCounts.followingCount > 0 ? "personal" : "global";
		initialItems =
			initialMode === "personal"
				? await getPersonalFeed(user.id, null, 20)
				: await getGlobalFeed(null, 20);
	}

	const initialMode = isExplore
		? "explore"
		: followCounts.followingCount > 0
			? "personal"
			: "global";

	// Show welcome banner only if onboarding not fully complete
	const showWelcome = !progressState.discogsConnected || followCounts.followingCount < 3;

	return (
		<div className="min-h-[calc(100vh-56px)]">
			<main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
				{/* Welcome / progress — only for new users */}
				{showWelcome && (
					<FeedWelcomeBanner
						discogsConnected={progressState.discogsConnected}
						followingCount={followCounts.followingCount}
					/>
				)}

				{/* Radar — the hero section */}
				{progressState.discogsConnected
					? <RadarSection userId={user.id} />
					: <RadarEmptyState />
				}

				{/* Feed */}
				<FeedContainer
					initialItems={initialItems}
					initialMode={initialMode}
					followingCount={followCounts.followingCount}
				/>
			</main>
		</div>
	);
}
