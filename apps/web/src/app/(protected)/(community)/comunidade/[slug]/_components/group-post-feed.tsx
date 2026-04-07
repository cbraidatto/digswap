"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useInView } from "react-intersection-observer";
import { loadGroupPostsAction } from "@/actions/community";
import type { GroupPost } from "@/lib/community/queries";
import { GroupPostCard } from "./group-post-card";
import { ReviewPostCard } from "./review-post-card";

interface GroupPostFeedProps {
	groupId: string;
	initialPosts: GroupPost[];
}

export function GroupPostFeed({ groupId, initialPosts }: GroupPostFeedProps) {
	const [posts, setPosts] = useState<GroupPost[]>(initialPosts);
	const [cursor, setCursor] = useState<string | null>(
		initialPosts.length > 0 ? initialPosts[initialPosts.length - 1].createdAt : null,
	);
	const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
	const [isPending, startTransition] = useTransition();
	const { ref: sentinelRef, inView } = useInView({ threshold: 0 });

	// Expose method to prepend new posts
	const _prependPost = useCallback((post: GroupPost) => {
		setPosts((prev) => [post, ...prev]);
	}, []);

	// Infinite scroll: load more when sentinel is in view
	useEffect(() => {
		if (inView && hasMore && !isPending) {
			startTransition(async () => {
				const newPosts = await loadGroupPostsAction(groupId, cursor ?? undefined);
				if (newPosts.length === 0) {
					setHasMore(false);
					return;
				}
				setPosts((prev) => {
					const existingIds = new Set(prev.map((p) => p.id));
					const deduplicated = newPosts.filter((p) => !existingIds.has(p.id));
					return [...prev, ...deduplicated];
				});
				setCursor(newPosts[newPosts.length - 1].createdAt);
				if (newPosts.length < 20) {
					setHasMore(false);
				}
			});
		}
	}, [inView, hasMore, isPending, cursor, groupId]);

	// Empty state
	if (posts.length === 0 && !isPending) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<span className="font-mono text-xs uppercase tracking-[0.2em] text-outline mb-4">
					[NO_POSTS_YET]
				</span>
				<p className="font-mono text-sm text-on-surface-variant">
					No posts yet. Start the conversation.
				</p>
			</div>
		);
	}

	return (
		<div>
			{/* Post list */}
			<div role="list">
				{posts.map((post, index) => (
					<div key={post.id} role="listitem">
						{index > 0 && <hr className="border-t border-outline-variant/10 my-0" />}
						{post.reviewId !== null ? (
							<ReviewPostCard post={post} />
						) : (
							<GroupPostCard post={post} />
						)}
					</div>
				))}
			</div>

			{/* Loading skeletons */}
			{isPending && (
				<div className="space-y-4 mt-4">
					{[1, 2, 3].map((i) => (
						<div key={i} className="animate-pulse">
							<div className="flex items-center gap-2 mb-2">
								<div className="h-2 w-16 bg-surface-container-low rounded" />
								<div className="h-2 w-10 bg-surface-container-low rounded" />
							</div>
							<div className="h-3 w-3/4 bg-surface-container-low rounded mb-1" />
							<div className="h-3 w-1/2 bg-surface-container-low rounded" />
						</div>
					))}
				</div>
			)}

			{/* Load more sentinel */}
			{hasMore && (
				<div className="text-center py-4">
					<span className="font-mono text-xs text-on-surface-variant">[load more posts]</span>
					<div ref={sentinelRef} className="h-10" aria-hidden="true" />
				</div>
			)}

			{/* End of feed */}
			{!hasMore && posts.length > 0 && (
				<div className="font-mono text-xs text-outline text-center py-8">[END_OF_FEED]</div>
			)}
		</div>
	);
}
