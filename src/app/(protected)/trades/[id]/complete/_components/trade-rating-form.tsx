"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { completeTrade, skipReview } from "@/actions/trades";
import { toast } from "sonner";

interface TradeRatingFormProps {
	tradeId: string;
	counterpartyUsername: string;
}

export function TradeRatingForm({ tradeId, counterpartyUsername }: TradeRatingFormProps) {
	const router = useRouter();
	const [selectedRating, setSelectedRating] = useState<number | null>(null);
	const [hoveredRating, setHoveredRating] = useState<number | null>(null);
	const [comment, setComment] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [skipping, setSkipping] = useState(false);

	// Keyboard navigation for star rating
	const handleStarKeyDown = useCallback(
		(e: React.KeyboardEvent, starValue: number) => {
			if (e.key === "ArrowRight" || e.key === "ArrowUp") {
				e.preventDefault();
				const next = Math.min(starValue + 1, 5);
				setSelectedRating(next);
			} else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
				e.preventDefault();
				const prev = Math.max(starValue - 1, 1);
				setSelectedRating(prev);
			} else if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				setSelectedRating(starValue);
			}
		},
		[],
	);

	// Submit review
	const handleSubmit = async () => {
		if (selectedRating === null) return;
		setSubmitting(true);

		try {
			const result = await completeTrade(
				tradeId,
				selectedRating,
				comment.trim() || null,
			);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success(`Trade completed! Rated ${counterpartyUsername} ${selectedRating}/5`);
				router.push("/trades");
			}
		} catch {
			toast.error("Failed to submit review. Please try again.");
		} finally {
			setSubmitting(false);
		}
	};

	// Skip review
	const handleSkip = async () => {
		setSkipping(true);

		try {
			const result = await skipReview(tradeId);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Trade completed without review.");
				router.push("/trades");
			}
		} catch {
			toast.error("Failed to complete trade. Please try again.");
		} finally {
			setSkipping(false);
		}
	};

	// Determine which stars are filled based on hover/selection
	const effectiveRating = hoveredRating ?? selectedRating ?? 0;

	return (
		<>
			{/* Rate quality */}
			<div className="w-full bg-surface-container-low rounded-xl p-6 mb-8 border border-outline-variant/10">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Rate_File_Quality
				</h2>

				{/* Star rating */}
				<div
					className="flex justify-center gap-3 mb-4"
					role="radiogroup"
					aria-label="Audio quality rating"
				>
					{[1, 2, 3, 4, 5].map((star) => {
						const isFilled = star <= effectiveRating;
						const isSelected = star === selectedRating;

						return (
							<button
								key={star}
								type="button"
								role="radio"
								aria-checked={isSelected}
								aria-label={`${star} star${star !== 1 ? "s" : ""}`}
								tabIndex={
									selectedRating === null
										? star === 1
											? 0
											: -1
										: star === selectedRating
											? 0
											: -1
								}
								onClick={() => setSelectedRating(star)}
								onMouseEnter={() => setHoveredRating(star)}
								onMouseLeave={() => setHoveredRating(null)}
								onKeyDown={(e) => handleStarKeyDown(e, star)}
								className={`w-10 h-10 rounded bg-surface-container-high flex items-center justify-center transition-colors ${
									isFilled
										? "text-secondary"
										: "text-on-surface-variant"
								}`}
							>
								<span className="material-symbols-outlined">
									{isFilled ? "star" : "star_border"}
								</span>
							</button>
						);
					})}
				</div>

				{/* Comment input */}
				<input
					type="text"
					value={comment}
					onChange={(e) => setComment(e.target.value)}
					placeholder="Add a comment (optional)..."
					className="w-full bg-surface-container-lowest border-none text-xs font-mono text-on-surface placeholder:text-on-surface-variant/40 rounded p-3 outline-none border-l-2 border-primary/30 focus:border-primary transition-colors"
					maxLength={500}
				/>
			</div>

			{/* Action buttons */}
			<div className="flex gap-4 w-full">
				<button
					type="button"
					onClick={handleSubmit}
					disabled={selectedRating === null || submitting}
					className="flex-1 py-3 bg-primary-container text-on-primary-container font-mono text-sm font-bold rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{submitting ? "SUBMITTING..." : "SUBMIT_REVIEW"}
				</button>
				<button
					type="button"
					onClick={handleSkip}
					disabled={skipping}
					className="flex-1 py-3 bg-surface-container-high text-on-surface-variant font-mono text-sm rounded hover:bg-surface-bright transition-all border border-outline-variant/20 disabled:opacity-50"
				>
					{skipping ? "SKIPPING..." : "SKIP_REVIEW"}
				</button>
			</div>
		</>
	);
}
