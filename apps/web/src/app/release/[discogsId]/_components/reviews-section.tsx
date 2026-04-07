"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { getMoreReviews } from "@/actions/release";

interface ReviewItem {
	id: string;
	userId: string;
	username: string | null;
	avatarUrl: string | null;
	rating: number;
	title: string | null;
	body: string | null;
	isPressingSpecific: boolean;
	pressingDetails: string | null;
	createdAt: string;
}

interface ReviewsSectionProps {
	releaseId: string;
	initialReviews: ReviewItem[];
	initialCount: number;
}

function formatRelativeDate(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "today";
	if (diffDays === 1) return "yesterday";
	if (diffDays < 30) return `${diffDays}d ago`;
	if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
	return `${Math.floor(diffDays / 365)}y ago`;
}

function StarRating({ rating }: { rating: number }) {
	return (
		<div className="flex items-center gap-0.5">
			{Array.from({ length: 5 }, (_, i) => (
				<span
					key={i}
					className={`material-symbols-outlined text-[14px] ${
						i < rating ? "text-secondary" : "text-on-surface-variant/30"
					}`}
				>
					star
				</span>
			))}
		</div>
	);
}

export function ReviewsSection({ releaseId, initialReviews, initialCount }: ReviewsSectionProps) {
	const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
	const [isLoading, setIsLoading] = useState(false);

	const hasMore = reviews.length < initialCount;

	async function handleLoadMore() {
		if (!hasMore || isLoading) return;
		setIsLoading(true);
		try {
			const lastReview = reviews[reviews.length - 1];
			if (!lastReview) return;
			const more = await getMoreReviews(releaseId, lastReview.createdAt, 10);
			setReviews((prev) => [...prev, ...more]);
		} catch {
			// Silently fail — user can try again
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<section className="space-y-3">
			<div className="flex items-center gap-2">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">REVIEWS</span>
				<span className="font-mono text-xs text-on-surface-variant bg-surface-container-high rounded-full px-2 py-0.5">
					{initialCount}
				</span>
			</div>

			{reviews.length === 0 ? (
				<p className="font-mono text-xs text-on-surface-variant">
					No reviews yet. Be the first to review this release.
				</p>
			) : (
				<div className="space-y-3">
					{reviews.map((review) => (
						<div
							key={review.id}
							className="bg-surface-container-low border border-outline-variant/10 rounded-lg p-4 space-y-2"
						>
							{/* Header row */}
							<div className="flex items-center gap-2">
								{review.avatarUrl ? (
									<Image
										src={review.avatarUrl}
										alt={review.username ?? "User"}
										width={32}
										height={32}
										unoptimized
										className="w-8 h-8 rounded object-cover shrink-0"
									/>
								) : (
									<div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center shrink-0">
										<span className="font-mono text-[12px] text-on-surface-variant">
											{(review.username ?? "?")[0]?.toUpperCase()}
										</span>
									</div>
								)}

								<div className="flex items-center gap-2 min-w-0 flex-1">
									{review.username ? (
										<Link
											href={`/perfil/${review.username}`}
											className="font-mono text-xs text-on-surface hover:text-primary transition-colors truncate"
										>
											{review.username}
										</Link>
									) : (
										<span className="font-mono text-xs text-on-surface-variant truncate">
											Anonymous
										</span>
									)}
									<span className="font-mono text-[9px] text-on-surface-variant shrink-0">
										{formatRelativeDate(review.createdAt)}
									</span>
								</div>
							</div>

							{/* Star rating */}
							<StarRating rating={review.rating} />

							{/* Title */}
							{review.title && (
								<h3 className="font-heading text-sm font-semibold text-on-surface">
									{review.title}
								</h3>
							)}

							{/* Body */}
							{review.body && <p className="text-sm text-on-surface-variant">{review.body}</p>}

							{/* Pressing specific badge */}
							{review.isPressingSpecific && (
								<span className="inline-block font-mono text-[9px] text-on-surface-variant bg-surface-container-high rounded px-1.5 py-0.5">
									PRESSING_SPECIFIC
								</span>
							)}
						</div>
					))}

					{/* Load more button */}
					{hasMore && (
						<div className="text-center pt-2">
							<button
								type="button"
								onClick={handleLoadMore}
								disabled={isLoading}
								className="font-mono text-xs text-primary hover:underline disabled:opacity-50"
							>
								{isLoading ? "LOADING..." : "LOAD_MORE"}
							</button>
						</div>
					)}
				</div>
			)}
		</section>
	);
}
