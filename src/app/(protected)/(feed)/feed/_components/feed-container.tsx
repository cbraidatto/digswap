"use client";

import { useState, useEffect, useTransition } from "react";
import { useInView } from "react-intersection-observer";
import type { FeedItem } from "@/actions/social";
import { loadMoreFeed } from "@/actions/social";
import { FeedCard } from "./feed-card";
import { FollowEventCard } from "./follow-event-card";
import { GroupFeedCard } from "./group-feed-card";

interface FeedContainerProps {
	initialItems: FeedItem[];
	initialMode: "personal" | "global";
	followingCount: number;
}

export function FeedContainer({
	initialItems,
	initialMode,
	followingCount,
}: FeedContainerProps) {
	const [items, setItems] = useState<FeedItem[]>(initialItems);
	const [cursor, setCursor] = useState<string | null>(
		initialItems.length > 0
			? initialItems[initialItems.length - 1].createdAt
			: null,
	);
	const [hasMore, setHasMore] = useState(initialItems.length >= 20);
	const [mode, setMode] = useState<"personal" | "global">(initialMode);
	const [isPending, startTransition] = useTransition();
	const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

	// Infinite scroll: load more when sentinel is in view
	useEffect(() => {
		if (inView && hasMore && !isPending) {
			startTransition(async () => {
				const newItems = await loadMoreFeed(cursor, mode);
				if (newItems.length === 0) {
					setHasMore(false);
					return;
				}
				setItems((prev) => {
					const existingIds = new Set(prev.map((item) => item.id));
					const deduplicated = newItems.filter(
						(item) => !existingIds.has(item.id),
					);
					return [...prev, ...deduplicated];
				});
				setCursor(newItems[newItems.length - 1].createdAt);
			});
		}
	}, [inView, hasMore, isPending, cursor, mode]);

	function handleModeSwitch(newMode: "personal" | "global") {
		if (newMode === mode) return;
		setMode(newMode);
		setItems([]);
		setCursor(null);
		setHasMore(true);
		startTransition(async () => {
			const newItems = await loadMoreFeed(null, newMode);
			if (newItems.length === 0) {
				setHasMore(false);
				return;
			}
			setItems(newItems);
			setCursor(newItems[newItems.length - 1].createdAt);
			if (newItems.length < 20) {
				setHasMore(false);
			}
		});
	}

	const subtitle =
		mode === "global"
			? "// ranked by rarity signal"
			: "// signals from diggers you follow";

	return (
		<div>
			{/* Subtitle */}
			<p className="font-mono text-sm text-on-surface-variant mb-6">
				{subtitle}
			</p>

			{/* Mode toggle - only show if user follows someone */}
			{followingCount > 0 && (
				<div
					role="tablist"
					className="bg-surface-container-low p-1 rounded-lg flex items-center gap-1 mb-6"
				>
					<button
						type="button"
						role="tab"
						aria-selected={mode === "global"}
						onClick={() => handleModeSwitch("global")}
						className={
							mode === "global"
								? "bg-primary text-on-primary text-[10px] font-bold rounded px-3 py-1.5 font-mono"
								: "text-on-surface-variant hover:text-on-surface text-[10px] font-bold px-3 py-1.5 font-mono"
						}
					>
						Global
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={mode === "personal"}
						onClick={() => handleModeSwitch("personal")}
						className={
							mode === "personal"
								? "bg-primary text-on-primary text-[10px] font-bold rounded px-3 py-1.5 font-mono"
								: "text-on-surface-variant hover:text-on-surface text-[10px] font-bold px-3 py-1.5 font-mono"
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
						<FeedCard key={item.id} item={item} />
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
					{mode === "personal" ? (
						<>
							<div className="font-mono text-sm text-primary mb-2">
								&gt; feed_empty
							</div>
							<div className="font-mono text-xs text-on-surface-variant mb-6 max-w-sm leading-relaxed">
								the diggers you follow haven&apos;t added any records yet.
								<br />
								new finds will surface here as they dig.
							</div>
							<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
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
							<div className="font-mono text-[10px] text-outline border border-outline-variant/20 px-4 py-2 rounded">
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
				<div className="font-mono text-[10px] text-outline text-center py-8">
					[END_OF_FEED]
				</div>
			)}
		</div>
	);
}
