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
import { ProgressBanner } from "./_components/progress-banner";
import { FeedContainer } from "./_components/feed-container";
import { RadarSection } from "./_components/radar-section";
import { RadarEmptyState } from "./_components/radar-empty-state";
import { BackButton } from "@/components/shell/back-button";

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

	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<header className="mb-8">
					<div className="flex items-center gap-4 mb-3">
						<BackButton />
					</div>
					<h1 className="font-heading text-3xl font-extrabold text-on-surface mb-2 uppercase tracking-tight">
						SIGNAL_BOARD
					</h1>
				</header>

				{progressState.discogsConnected
					? <RadarSection userId={user.id} />
					: <RadarEmptyState />
				}

				<ProgressBanner
					discogsConnected={progressState.discogsConnected}
					followingCount={progressState.followingCount}
				/>

				<FeedContainer
					initialItems={initialItems}
					initialMode={initialMode}
					followingCount={followCounts.followingCount}
				/>
			</main>
		</div>
	);
}
