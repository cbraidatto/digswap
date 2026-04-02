"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { logListening } from "@/actions/engagement";

interface SpinningLogButtonProps {
	releaseId: string;
	releaseTitle: string;
}

export function SpinningLogButton({ releaseId, releaseTitle }: SpinningLogButtonProps) {
	const [open, setOpen] = useState(false);
	const [caption, setCaption] = useState("");
	const [rating, setRating] = useState<number | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleSubmit() {
		startTransition(async () => {
			const result = await logListening(
				releaseId,
				caption.trim() || undefined,
				rating ?? undefined,
			);

			if (result.success) {
				toast.success(`Logged "${releaseTitle}"!`);
				setOpen(false);
				setCaption("");
				setRating(null);
			} else {
				toast.error(result.error ?? "Could not log listening");
			}
		});
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className="mt-2 flex items-center gap-1 font-mono text-[10px] text-on-surface-variant hover:text-primary transition-colors uppercase tracking-[0.12em] px-2 py-1 rounded border border-outline/20 hover:border-primary/30"
				title={`Log a spin of "${releaseTitle}"`}
			>
				<span className="material-symbols-outlined text-[13px]">album</span>
				Log Spin
			</PopoverTrigger>

			<PopoverContent
				side="top"
				align="start"
				className="w-64 p-3 space-y-3"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<p className="font-mono text-[10px] uppercase tracking-[0.15em] text-on-surface-variant truncate">
					{releaseTitle}
				</p>

				{/* Caption textarea */}
				<div>
					<label
						htmlFor={`caption-${releaseId}`}
						className="font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant block mb-1"
					>
						Caption <span className="text-outline/50">(optional)</span>
					</label>
					<textarea
						id={`caption-${releaseId}`}
						value={caption}
						onChange={(e) => setCaption(e.target.value)}
						maxLength={280}
						rows={2}
						placeholder="What are you feeling?"
						className="w-full bg-surface-container-high border border-outline/20 rounded px-2 py-1.5 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 resize-none focus:outline-none focus:border-primary/40 transition-colors"
					/>
					<p className="text-right font-mono text-[9px] text-outline/60 mt-0.5">
						{caption.length}/280
					</p>
				</div>

				{/* Star rating */}
				<div>
					<p className="font-mono text-[10px] uppercase tracking-[0.12em] text-on-surface-variant mb-1">
						Rating <span className="text-outline/50">(optional)</span>
					</p>
					<div className="flex items-center gap-1">
						{[1, 2, 3, 4, 5].map((star) => (
							<button
								key={star}
								type="button"
								onClick={() => setRating(rating === star ? null : star)}
								className={`text-lg leading-none transition-colors ${
									rating !== null && star <= rating
										? "text-primary"
										: "text-outline/30 hover:text-primary/60"
								}`}
								title={`${star} star${star > 1 ? "s" : ""}`}
							>
								★
							</button>
						))}
						{rating !== null && (
							<button
								type="button"
								onClick={() => setRating(null)}
								className="ml-1 font-mono text-[9px] text-outline/50 hover:text-on-surface-variant transition-colors"
							>
								✕
							</button>
						)}
					</div>
				</div>

				{/* Submit */}
				<button
					type="button"
					onClick={handleSubmit}
					disabled={isPending}
					className="w-full font-mono text-xs uppercase tracking-[0.15em] bg-primary/10 hover:bg-primary/20 border border-primary/30 text-primary rounded px-3 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{isPending ? "Logging…" : "Log it"}
				</button>
			</PopoverContent>
		</Popover>
	);
}
