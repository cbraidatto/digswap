"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createPostAction, createReviewAction } from "@/actions/community";
import type { GroupPost } from "@/lib/community/queries";
import { RecordSearchInline } from "./record-search-inline";

interface LinkedRecord {
	id: string;
	title: string;
	artist: string;
	label: string | null;
	year: number | null;
	format: string | null;
}

interface GroupComposerProps {
	groupId: string;
	groupName: string;
	onPostCreated?: (post: GroupPost) => void;
}

export function GroupComposer({
	groupId,
	groupName: _groupName,
	onPostCreated: _onPostCreated,
}: GroupComposerProps) {
	const [content, setContent] = useState("");
	const [linkedRecord, setLinkedRecord] = useState<LinkedRecord | null>(null);
	const [isReviewMode, setIsReviewMode] = useState(false);
	const [rating, setRating] = useState<number | null>(null);
	const [isSubmitting, startTransition] = useTransition();
	const [errors, setErrors] = useState<Record<string, string>>({});

	function handleStarClick(starIndex: number) {
		// Clicking same star clears rating
		if (rating === starIndex) {
			setRating(null);
		} else {
			setRating(starIndex);
		}
		setErrors((prev) => {
			const next = { ...prev };
			delete next.rating;
			return next;
		});
	}

	function handleSubmit() {
		const newErrors: Record<string, string> = {};

		if (!content.trim()) {
			newErrors.content = "Content is required";
		}

		if (isReviewMode) {
			if (!rating) {
				newErrors.rating = "Rating is required";
			}
			if (!linkedRecord) {
				newErrors.record = "RECORD_REQUIRED";
			}
		}

		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}

		setErrors({});

		if (isReviewMode && linkedRecord && rating) {
			startTransition(async () => {
				try {
					await createReviewAction({
						groupId,
						releaseId: linkedRecord.id,
						rating,
						body: content,
						title: undefined,
						isPressingSpecific: false,
					});
					toast("Review published.");
					resetForm();
				} catch {
					toast("Failed to post. Please try again.");
				}
			});
		} else {
			startTransition(async () => {
				try {
					await createPostAction({
						groupId,
						content,
						releaseId: linkedRecord?.id,
					});
					toast("Post published.");
					resetForm();
				} catch {
					toast("Failed to post. Please try again.");
				}
			});
		}
	}

	function resetForm() {
		setContent("");
		setLinkedRecord(null);
		setRating(null);
		setIsReviewMode(false);
		setErrors({});
	}

	return (
		<div className="mb-6">
			{/* Review mode label */}
			{isReviewMode && (
				<div className="font-mono text-xs text-on-surface-variant mb-2">
					&middot; review mode &middot;
				</div>
			)}

			{/* Star rating selector (review mode) */}
			{isReviewMode && (
				<div className="mb-2">
					<div role="radiogroup" className="flex items-center gap-1" aria-label="Rating">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								type="button"
								aria-pressed={rating === star}
								aria-label={`Rating: ${star} out of 5 stars`}
								onClick={() => handleStarClick(star)}
								className={`text-sm font-mono transition-colors ${
									rating !== null && star <= rating
										? "text-tertiary"
										: "text-on-surface-variant/40 hover:text-tertiary/80"
								}`}
							>
								{rating !== null && star <= rating ? "\u2605" : "\u2606"}
							</button>
						))}
					</div>
					{errors.rating && (
						<span className="font-mono text-xs text-destructive mt-1 block">{errors.rating}</span>
					)}
				</div>
			)}

			{/* Textarea */}
			<textarea
				value={content}
				onChange={(e) => {
					setContent(e.target.value);
					setErrors((prev) => {
						const next = { ...prev };
						delete next.content;
						return next;
					});
				}}
				placeholder="Write a post..."
				className="bg-surface-container-low border border-outline-variant/20 rounded p-3 w-full resize-none min-h-[80px] text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
			/>
			{errors.content && (
				<span className="font-mono text-xs text-destructive mt-1 block">{errors.content}</span>
			)}

			{/* Linked record display */}
			{linkedRecord && (
				<div className="flex items-center gap-2 mt-2">
					<span className="font-mono text-xs text-on-surface-variant">
						&#9492; {linkedRecord.artist} - {linkedRecord.title}
						{linkedRecord.label || linkedRecord.year
							? ` [${[linkedRecord.label, linkedRecord.year].filter(Boolean).join(", ")}]`
							: ""}
					</span>
					<button
						type="button"
						onClick={() => {
							setLinkedRecord(null);
							setErrors((prev) => {
								const next = { ...prev };
								delete next.record;
								return next;
							});
						}}
						className="text-xs text-on-surface-variant hover:text-destructive transition-colors"
					>
						[x]
					</button>
				</div>
			)}
			{isReviewMode && errors.record && (
				<span className="font-mono text-xs text-destructive mt-1 block">{errors.record}</span>
			)}

			{/* Button row */}
			<div className="flex items-center justify-between mt-2">
				<div className="flex items-center gap-2">
					<RecordSearchInline onSelect={setLinkedRecord}>
						<button
							type="button"
							className="font-mono text-xs text-on-surface-variant border border-outline-variant/20 px-2 py-1 rounded hover:text-primary hover:border-primary transition-colors"
						>
							[+ link record]
						</button>
					</RecordSearchInline>

					<button
						type="button"
						onClick={() => {
							setIsReviewMode(!isReviewMode);
							if (isReviewMode) {
								setRating(null);
							}
							setErrors({});
						}}
						className={`font-mono text-xs border px-2 py-1 rounded transition-colors ${
							isReviewMode
								? "text-primary border-primary bg-primary/10"
								: "text-on-surface-variant border-outline-variant/20 hover:text-primary hover:border-primary"
						}`}
					>
						[Write review]
					</button>
				</div>

				<div className="flex items-center gap-2">
					{(content.trim() || linkedRecord || rating) && (
						<button
							type="button"
							onClick={resetForm}
							className="font-mono text-xs text-muted-foreground hover:text-foreground border border-outline-variant/20 px-3 py-1 rounded transition-colors"
						>
							[Reset]
						</button>
					)}
					<button
						type="button"
						onClick={handleSubmit}
						disabled={!content.trim() || isSubmitting}
						className="font-mono text-xs bg-primary text-primary-foreground px-4 py-1 rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{isSubmitting ? "posting..." : isReviewMode ? "[Post Review]" : "[Post]"}
					</button>
				</div>
			</div>
		</div>
	);
}
