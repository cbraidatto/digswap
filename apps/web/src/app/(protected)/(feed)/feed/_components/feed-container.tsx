"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useInView } from "react-intersection-observer";
import { loadExploreFeed, loadMoreFeed } from "@/actions/social";
import type { ContextReason } from "@/components/feed/context-label";
import type { FeedItem } from "@/lib/social/types";
import { FeedCard } from "./feed-card";
import { FollowEventCard } from "./follow-event-card";
import { GroupFeedCard } from "./group-feed-card";

type FeedMode = "personal" | "global" | "explore";

interface FeedContainerProps {
	initialItems: FeedItem[];
	initialMode: FeedMode;
	followingCount: number;
}

function _resolveSubMode(count: number): "personal" | "global" {
	return count > 0 ? "personal" : "global";
}

const TABS = [
	{ key: "following" as const, label: "Following", icon: "group" },
	{ key: "global" as const, label: "Global", icon: "public" },
	{ key: "explore" as const, label: "Discover", icon: "explore" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function FeedContainer({ initialItems, initialMode, followingCount }: FeedContainerProps) {
	const router = useRouter();

	const initialTab: TabKey =
		initialMode === "explore" ? "explore" : initialMode === "personal" ? "following" : "global";

	const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
	const [items, setItems] = useState<FeedItem[]>(initialItems);
	const [cursor, setCursor] = useState<string | null>(
		initialItems.length > 0 ? initialItems[initialItems.length - 1].createdAt : null,
	);
	const [hasMore, setHasMore] = useState(initialItems.length >= 20);
	const [isPending, startTransition] = useTransition();
	const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

	const currentMode: FeedMode =
		activeTab === "explore" ? "explore" : activeTab === "following" ? "personal" : "global";

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
					return [...prev, ...newItems.filter((item) => !existingIds.has(item.id))];
				});
				setCursor(newItems[newItems.length - 1].createdAt);
				if (newItems.length < 20) setHasMore(false);
			});
		}
	}, [inView, hasMore, isPending, cursor, currentMode]);

	function switchTab(tab: TabKey) {
		if (tab === activeTab) return;
		setActiveTab(tab);
		setItems([]);
		setCursor(null);
		setHasMore(true);

		const url = tab === "explore" ? "?tab=explore" : "?";
		router.replace(url);

		startTransition(async () => {
			let newItems: FeedItem[];
			if (tab === "explore") {
				newItems = await loadExploreFeed(null);
			} else {
				const mode = tab === "following" ? "personal" : "global";
				newItems = await loadMoreFeed(null, mode);
			}
			setItems(newItems);
			setCursor(newItems.length > 0 ? newItems[newItems.length - 1].createdAt : null);
			setHasMore(newItems.length >= 20);
		});
	}

	return (
		<section>
			{/* Section header + tab bar */}
			<div className="flex items-center justify-between mb-5">
				<h2 className="font-heading text-xl font-bold text-on-surface">Activity</h2>

				{/* Tab bar */}
				<div
					role="tablist"
					aria-label="Feed tabs"
					className="flex items-center gap-1 bg-surface-container-high/40 rounded-full p-1"
				>
					{TABS.map((tab) => {
						if (tab.key === "following" && followingCount === 0) return null;
						const isActive = activeTab === tab.key;
						return (
							<button
								key={tab.key}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => switchTab(tab.key)}
								className={`flex items-center gap-1.5 px-4 py-2 rounded-full font-mono text-xs uppercase tracking-wider transition-all duration-200 ${
									isActive
										? "bg-primary text-background font-semibold shadow-md shadow-primary/20"
										: "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high/60"
								}`}
							>
								<span
									className="material-symbols-outlined text-[15px]"
									style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
								>
									{tab.icon}
								</span>
								{tab.label}
							</button>
						);
					})}
				</div>
			</div>

			{/* Feed items */}
			<div aria-live="polite" className="space-y-4">
				{items.map((item) =>
					item.actionType === "added_record" || item.actionType === "spinning_now" ? (
						<FeedCard
							key={item.id}
							item={item}
							contextReason={
								activeTab === "explore"
									? ((item.contextReason as ContextReason | undefined) ?? null)
									: undefined
							}
						/>
					) : item.actionType === "followed_user" ? (
						<FollowEventCard key={item.id} item={item} />
					) : item.actionType === "group_post" || item.actionType === "wrote_review" ? (
						<GroupFeedCard key={item.id} item={item} />
					) : (
						<FeedCard key={item.id} item={item} />
					),
				)}
			</div>

			{/* Empty state */}
			{items.length === 0 && !isPending && !hasMore && (
				<div className="rounded-2xl border border-dashed border-outline-variant/15 p-16 flex flex-col items-center text-center">
					<div className="w-16 h-16 rounded-2xl bg-surface-container-high/60 flex items-center justify-center mb-4">
						<span
							className="material-symbols-outlined text-3xl text-on-surface-variant/25"
							style={{ fontVariationSettings: "'FILL' 1" }}
						>
							{activeTab === "explore"
								? "travel_explore"
								: activeTab === "following"
									? "group"
									: "public"}
						</span>
					</div>
					<p className="font-mono text-sm text-on-surface-variant mb-1">
						{activeTab === "following"
							? "No activity from diggers you follow yet"
							: activeTab === "explore"
								? "No new discoveries outside your network"
								: "No activity in the global feed yet"}
					</p>
					<p className="font-mono text-xs text-on-surface-variant/40">
						New records will appear here as diggers add them
					</p>
				</div>
			)}

			{/* Loading */}
			{isPending && (
				<div className="space-y-4 mt-4">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="bg-surface-container-low rounded-2xl h-40 animate-pulse border border-outline-variant/5"
						/>
					))}
				</div>
			)}

			{/* Infinite scroll sentinel */}
			<div ref={sentinelRef} className="h-10" aria-hidden="true" />

			{/* End of feed */}
			{!hasMore && items.length > 0 && (
				<div className="flex items-center gap-3 justify-center py-8">
					<div className="h-px flex-1 max-w-[60px] bg-outline-variant/15" />
					<p className="font-mono text-[11px] text-on-surface-variant/30">
						You&apos;re all caught up
					</p>
					<div className="h-px flex-1 max-w-[60px] bg-outline-variant/15" />
				</div>
			)}
		</section>
	);
}
