"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitTradeReviewAction } from "@/actions/trades";

interface Props {
	tradeId: string;
	status: string;
}

export function TradeReviewForm({ tradeId, status }: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [rating, setRating] = useState(0);
	const [comment, setComment] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [submitted, setSubmitted] = useState(false);

	if (status !== "completed") return null;
	if (submitted) {
		return (
			<div className="border border-outline-variant/20 rounded p-4 bg-surface-container-low">
				<p className="font-mono text-xs text-tertiary">✓ Review submitted. Thanks!</p>
			</div>
		);
	}

	function handleSubmit() {
		if (rating < 1 || rating > 5) {
			setError("Please select a rating (1-5).");
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await submitTradeReviewAction({
				tradeId,
				qualityRating: rating,
				comment: comment.trim() || undefined,
			});
			if (!result.success) {
				setError(result.error ?? "Something went wrong.");
			} else {
				setSubmitted(true);
				router.refresh();
			}
		});
	}

	return (
		<div className="border border-outline-variant/20 rounded p-4 bg-surface-container-low mt-6">
			<h3 className="font-mono text-xs text-on-surface-variant uppercase tracking-widest mb-3">
				Rate this trade
			</h3>

			{/* Star rating */}
			<div className="flex items-center gap-1 mb-3">
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						key={star}
						type="button"
						onClick={() => setRating(star)}
						className={`text-lg transition-colors ${
							star <= rating
								? "text-primary"
								: "text-outline-variant/30 hover:text-outline-variant"
						}`}
					>
						<span className="material-symbols-outlined text-xl">
							{star <= rating ? "star" : "star_border"}
						</span>
					</button>
				))}
				{rating > 0 && (
					<span className="font-mono text-xs text-muted-foreground ml-2">
						{rating}/5
					</span>
				)}
			</div>

			{/* Comment */}
			<textarea
				value={comment}
				onChange={(e) => setComment(e.target.value)}
				placeholder="Optional comment about the trade..."
				maxLength={2000}
				rows={2}
				className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded p-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/50"
			/>

			{error && (
				<p className="font-mono text-xs text-destructive mt-1">{error}</p>
			)}

			<button
				type="button"
				disabled={isPending || rating < 1}
				onClick={handleSubmit}
				className="mt-2 font-mono text-xs font-bold px-4 py-2 rounded bg-primary text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
			>
				{isPending ? "Submitting..." : "Submit Review"}
			</button>
		</div>
	);
}
