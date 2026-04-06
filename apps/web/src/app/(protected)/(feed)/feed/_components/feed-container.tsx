"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useInView } from "react-intersection-observer";
import type { FeedItem } from "@/lib/social/types";
import { loadMoreFeed, loadExploreFeed } from "@/actions/social";
import { FeedCard } from "./feed-card";
import { FollowEventCard } from "./follow-event-card";
import { GroupFeedCard } from "./group-feed-card";
import type { ContextReason } from "@/components/feed/context-label";

type FeedMode = "personal" | "global" | "explore";

interface FeedContainerProps {
	initialItems: FeedItem[];
	initialMode: FeedMode;
	followingCount: number;
}

export function FeedContainer({
	initialItems,
	initialMode,
	followingCount,
}: FeedContainerProps) {
	const router = useRouter();

	// "Feed" tab covers personal + global; "Explore" is a separate tab
	const initialTopTab: "feed" | "explore" =
		initialMode === "explore" ? "explore" : "feed";

	const [topTab, setTopTab] = useState<"feed" | "explore">(initialTopTab);
	const [items, setItems] = useState<FeedItem[]>(initialItems);
	const [cursor, setCursor] = useState<string | null>(
		initialItems.length > 0
			? initialItems[initialItems.length - 1].createdAt
			: null,
	);
	const [hasMore, setHasMore] = useState(initialItems.length >= 20);

	// Feed sub-mode (personal vs global) — only relevant when topTab === "feed"
	const initialSubMode: "personal" | "global" =
		initialMode === "personal" || initialMode === "global"
			? initialMode
			: followCounts(followingCount);
	const [subMode, setSubMode] = useState<"personal" | "global">(
		initialSubMode,
	);

	const [isPending, startTransition] = useTransition();
	const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

	// Helpers
	function followCounts(count: number): "personal" | "global" {
		return count > 0 ? "personal" : "global";
	}

	const currentMode: FeedMode =
		topTab === "explore" ? "explore" : subMode;

	// Infinite scroll
	useEffect(() => {
		if (inView && hasMore && !isPending) {
			startTransition(async () => {
				let newItems: FeedItem[];
				if (currentMode === "explore") {
					newItems = await loadExploreFeed(cursor);
				} else {
					newItems = await loadMoreFeed(cursor, currentMode);
				}
				if (newItems.length === 0) {
					setHasMore(false);
					return;
				}
				setItems((prev) => {
					const existingIds = new Set(prev.map((item) => item.id));
					return [
						...prev,
						...newItems.filter((item) => !existingIds.has(item.id)),
					];
				});
				setCursor(newItems[newItems.length - 1].createdAt);
				if (newItems.length < 20) setHasMore(false);
			});
		}
	}, [inView, hasMore, isPending, cursor, currentMode]);

	function switchTopTab(next: "feed" | "explore") {
		if (next === topTab) return;
		setTopTab(next);
		setItems([]);
		setCursor(null);
		setHasMore(true);

		// Update URL without full navigation
		const url = next === "explore" ? "?tab=explore" : "?";
		router.replace(url);

		// Log signal when switching to Explore (non-blocking)
		if (next === "explore") {
			import("@/actions/search-signals").then(({ logSearchSignal }) => {
				void logSearchSignal([], []);
			});
		}

		// Immediately load content for the new tab
		startTransition(async () => {
			let newItems: FeedItem[];
			if (next === "explore") {
				newItems = await loadExploreFeed(null);
			} else {
				newItems = await loadMoreFeed(null, subMode);
			}
			setItems(newItems);
			setCursor(
				newItems.length > 0
					? newItems[newItems.length - 1].createdAt
					: null,
			);
			setHasMore(newItems.length >= 20);
		});
	}

	function handleSubModeSwitch(newMode: "personal" | "global") {
		if (newMode === subMode) return;
		setSubMode(newMode);
		setItems([]);
		setCursor(null);
		setHasMore(true);
		startTransition(async () => {
			const newItems = await loadMoreFeed(null, newMode);
			setItems(newItems);
			setCursor(
				newItems.length > 0
					? newItems[newItems.length - 1].createdAt
					: null,
			);
			setHasMore(newItems.length >= 20);
		});
	}

	const subtitle =
		topTab === "explore"
			? "// discover beyond your network"
			: subMode === "global"
				? "// ranked by rarity signal"
				: "// signals from diggers you follow";

	return (
		<div>
			{/* Top-level tab switcher: Feed | Explore */}
			<div
				role="tablist"
				aria-label="Content tabs"
				className="bg-surface-container-low p-1 rounded-lg flex items-center gap-1 mb-4"
			>
				<button
					type="button"
					role="tab"
					aria-selected={topTab === "feed"}
					onClick={() => switchTopTab("feed")}
					className={
						topTab === "feed"
							? "bg-primary text-on-primary text-xs font-bold rounded px-3 py-1.5 font-mono"
							: "text-on-surface-variant hover:text-on-surface text-xs font-bold px-3 py-1.5 font-mono"
					}
				>
					Feed
				</button>
				<button
					type="button"
					role="tab"
					aria-selected={topTab === "explore"}
					onClick={() => switchTopTab("explore")}
					className={
						topTab === "explore"
							? "bg-primary text-on-primary text-xs font-bold rounded px-3 py-1.5 font-mono"
							: "text-on-surface-variant hover:text-on-surface text-xs font-bold px-3 py-1.5 font-mono"
					}
				>
					Explore
				</button>
			</div>

			{/* Subtitle */}
			<p className="font-mono text-sm text-on-surface-variant mb-6">
				{subtitle}
			</p>

			{/* Feed sub-mode toggle — only visible on Feed tab when user follows someone */}
			{topTab === "feed" && followingCount > 0 && (
				<div
					role="tablist"
					className="bg-surface-container-low p-1 rounded-lg flex items-center gap-1 mb-6"
				>
					<button
						type="button"
						role="tab"
						aria-selected={subMode === "global"}
						onClick={() => handleSubModeSwitch("global")}
						className={
							subMode === "global"
								? "bg-primary text-on-primary text-xs font-bold rounded px-3 py-1.5 font-mono"
								: "text-on-surface-variant hover:text-on-surface text-xs font-bold px-3 py-1.5 font-mono"
						}
					>
						Global
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={subMode === "personal"}
						onClick={() => handleSubModeSwitch("personal")}
						className={
							subMode === "personal"
								? "bg-primary text-on-primary text-xs font-bold rounded px-3 py-1.5 font-mono"
								: "text-on-surface-variant hover:text-on-surface text-xs font-bold px-3 py-1.5 font-mono"
						}
					>
						Following
					</button>
				</div>
			)}

			{/* Feed items */}
			<div aria-live="polite" className="space-y-4">
				{items.map((item) =>
					item.actionType === "added_record" ? (
						<FeedCard
							key={item.id}
							item={item}
							contextReason={
								topTab === "explore"
									? ((item.contextReason as ContextReason | undefined) ?? null)
									: undefined
							}
						/>
					) : item.actionType === "followed_user" ? (
						<FollowEventCard key={item.id} item={item} />
					) : item.actionType === "group_post" ||
						item.actionType === "wrote_review" ? (
						<GroupFeedCard key={item.id} item={item} />
					) : null,
				)}
			</div>

			{/* Empty states */}
			{items.length === 0 && !isPending && !hasMore && (
				<section className="bg-surface-container-low rounded-xl p-12 flex flex-col items-center justify-center text-center border border-outline-variant/10">
					<span className="material-symbols-outlined text-primary text-5xl mb-6 opacity-60">
						sensors_off
					</span>
					{topTab === "explore" ? (
						<>
							<div className="font-mono text-sm text-primary mb-2">
								&gt; explore_empty
							</div>
							<div className="font-mono text-xs text-on-surface-variant mb-6 max-w-sm leading-relaxed">
								no new finds outside your network yet.
								<br />
								check back as more diggers log their records.
							</div>
							<div className="font-mono text-xs text-outline border border-outline-variant/20 px-4 py-2 rounded">
								[SCANNING_BEYOND_NETWORK]
							</div>
						</>
					) : subMode === "personal" ? (
						<>
							<div className="font-mono text-sm text-primary mb-2">
								&gt; feed_empty
							</div>
							<div className="font-mono text-xs text-on-surface-variant mb-6 max-w-sm leading-relaxed">
								the diggers you follow haven&apos;t added any records yet.
								<br />
								new finds will surface here as they dig.
							</div>
							<div className="font-mono text-xs text-outline border border-outline-variant/20 px-4 py-2 rounded">
								[AWAITING_SIGNAL]
							</div>
						</>
					) : (
						<>
							<div className="font-mono text-sm text-primary mb-2">
								&gt; no signals yet
							</div>
							<div className="font-mono text-xs text-on-surface-variant mb-6 max-w-sm leading-relaxed">
								follow diggers to see their finds, rips, and trades here.
								<br />
								the feed goes live once you connect.
							</div>
							<div className="font-mono text-xs text-outline border border-outline-variant/20 px-4 py-2 rounded">
								[AWAITING_CONNECTION]
							</div>
						</>
					)}
				</section>
			)}

			{/* Loading skeletons */}
			{isPending && (
				<div className="space-y-4 mt-4">
					<div className="bg-surface-container-low rounded-lg h-48 animate-pulse" />
					<div className="bg-surface-container-low rounded-lg h-48 animate-pulse" />
					<div className="bg-surface-container-low rounded-lg h-48 animate-pulse" />
				</div>
			)}

			{/* Sentinel for infinite scroll */}
			<div ref={sentinelRef} className="h-10" aria-hidden="true" />

			{/* End of feed */}
			{!hasMore && items.length > 0 && (
				<div className="font-mono text-xs text-outline text-center py-8">
					[END_OF_FEED]
				</div>
			)}
		</div>
	);
}
