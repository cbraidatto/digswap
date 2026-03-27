import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
	getProgressBarState,
	getFollowCounts,
	getGlobalFeed,
	getPersonalFeed,
} from "@/lib/social/queries";
import { ProgressBanner } from "./_components/progress-banner";
import { FeedContainer } from "./_components/feed-container";
import { FeedShowcase } from "./_components/feed-showcase";
import { BackButton } from "@/components/shell/back-button";

export default async function FeedPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const [progressState, followCounts] = await Promise.all([
		getProgressBarState(user.id),
		getFollowCounts(user.id),
	]);

	const initialMode =
		followCounts.followingCount > 0 ? "personal" : "global";

	const initialFeed =
		initialMode === "personal"
			? await getPersonalFeed(user.id, null, 20)
			: await getGlobalFeed(null, 20);

	return (
		<div className="flex min-h-[calc(100vh-56px)]">
			<main className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<header className="mb-8">
					<div className="flex items-center gap-4 mb-3">
						<BackButton />
					</div>
					<h1 className="font-heading text-3xl font-extrabold text-on-surface mb-2 uppercase tracking-tight">
						ARCHIVE_FEED
					</h1>
				</header>

				<FeedShowcase />

				<ProgressBanner
					discogsConnected={progressState.discogsConnected}
					followingCount={progressState.followingCount}
				/>

				<FeedContainer
					initialItems={initialFeed}
					initialMode={initialMode}
					followingCount={followCounts.followingCount}
				/>
			</main>
		</div>
	);
}
