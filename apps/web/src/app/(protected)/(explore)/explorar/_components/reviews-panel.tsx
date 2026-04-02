"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { loadReviewsForReleaseAction } from "@/actions/community";
import { StarRating } from "@/components/ui/star-rating";
import type { ReviewItem } from "@/lib/community/queries";

function formatRelativeTime(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const minutes = Math.floor(diff / 60_000);
	if (minutes < 1) return "now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

interface ReviewsPanelProps {
	releaseId: string;
	isExpanded: boolean;
}

export function ReviewsPanel({ releaseId, isExpanded }: ReviewsPanelProps) {
	const [reviews, setReviews] = useState<ReviewItem[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [cursor, setCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);

	useEffect(() => {
		if (isExpanded) {
			setIsLoading(true);
			loadReviewsForReleaseAction(releaseId)
				.then((items) => {
					setReviews(items);
					if (items.length >= 5) {
						setCursor(items[items.length - 1].createdAt);
						setHasMore(true);
					} else {
						setCursor(null);
						setHasMore(false);
					}
				})
				.finally(() => setIsLoading(false));
		} else {
			// Clear state when collapsed
			setReviews([]);
			setCursor(null);
			setHasMore(false);
		}
	}, [isExpanded, releaseId]);

	const loadMore = useCallback(() => {
		if (!cursor || isLoading) return;
		setIsLoading(true);
		loadReviewsForReleaseAction(releaseId, cursor)
			.then((items) => {
				setReviews((prev) => [...prev, ...items]);
				if (items.length >= 5) {
					setCursor(items[items.length - 1].createdAt);
					setHasMore(true);
				} else {
					setCursor(null);
					setHasMore(false);
				}
			})
			.finally(() => setIsLoading(false));
	}, [cursor, isLoading, releaseId]);

	if (!isExpanded) return null;

	// Loading skeleton
	if (isLoading && reviews.length === 0) {
		return (
			<div className="bg-surface-container-lowest border-t border-outline-variant/10 px-4 pt-3 pb-3">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-outline pb-2">
					REVIEWS
				</div>
				{/* Skeleton review rows */}
				<div className="space-y-3">
					{[0, 1].map((i) => (
						<div key={i} className="space-y-1.5 animate-pulse">
							<div className="h-3 bg-surface-container-high rounded w-32" />
							<div className="h-3 bg-surface-container-high rounded w-full" />
							<div className="h-3 bg-surface-container-high rounded w-3/4" />
						</div>
					))}
				</div>
			</div>
		);
	}

	// Zero reviews
	if (!isLoading && reviews.length === 0) {
		return (
			<div className="bg-surface-container-lowest border-t border-outline-variant/10 px-4 pt-3 pb-3">
				<div className="font-mono text-xs uppercase tracking-[0.2em] text-outline pb-2">
					REVIEWS
				</div>
				<div className="py-2">
					<div className="font-mono text-xs text-on-surface-variant">
						[NO_REVIEWS_YET]
					</div>
					<div className="font-mono text-xs text-on-surface-variant mt-1">
						Be the first to review this record.
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-surface-container-lowest border-t border-outline-variant/10 px-4 pt-3 pb-3">
			<div className="font-mono text-xs uppercase tracking-[0.2em] text-outline pb-2">
				REVIEWS
			</div>

			{reviews.map((review, index) => (
				<div key={review.id}>
					{index > 0 && (
						<hr className="border-t border-outline-variant/10 my-2" />
					)}
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<StarRating rating={review.rating} />
							<Link
								href={`/perfil/${review.username}`}
								className="font-mono text-xs text-on-surface hover:text-primary transition-colors"
							>
								@{review.username}
							</Link>
							<span className="font-mono text-xs text-on-surface-variant">
								{" \u00B7 "}
								{formatRelativeTime(review.createdAt)}
							</span>
						</div>
						{review.body && (
							<p className="text-sm text-on-surface leading-relaxed line-clamp-3">
								{review.body}
							</p>
						)}
					</div>
				</div>
			))}

			{/* Load more */}
			{hasMore && (
				<div className="mt-2">
					<button
						type="button"
						onClick={loadMore}
						disabled={isLoading}
						className="font-mono text-xs text-on-surface-variant hover:text-on-surface transition-colors"
					>
						{isLoading ? "[loading...]" : "[load more reviews]"}
					</button>
				</div>
			)}
		</div>
	);
}
