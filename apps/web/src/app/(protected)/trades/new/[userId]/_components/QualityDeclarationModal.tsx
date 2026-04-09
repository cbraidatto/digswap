"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TradeableItem } from "@/lib/trades/proposal-queries";

interface QualityDeclarationModalProps {
	item: TradeableItem | null;
	side: "offer" | "want";
	onConfirm: (
		item: TradeableItem,
		quality: { declaredQuality: string; conditionNotes?: string },
	) => void;
	onClose: () => void;
}

const QUALITY_GRADES = [
	"Mint",
	"Near Mint",
	"VG+",
	"VG",
	"Good",
	"Fair",
	"Poor",
] as const;

export function QualityDeclarationModal({
	item,
	side,
	onConfirm,
	onClose,
}: QualityDeclarationModalProps) {
	const [declaredQuality, setDeclaredQuality] = useState<string>(
		item?.conditionGrade ?? "",
	);
	const [conditionNotes, setConditionNotes] = useState("");

	// Reset state when item changes
	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose();
		}
	};

	// When item changes, pre-fill from condition grade
	const currentItem = item;

	return (
		<Dialog
			open={!!currentItem}
			onOpenChange={handleOpenChange}
		>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Declare Quality</DialogTitle>
					{currentItem && (
						<DialogDescription>
							{currentItem.title} by {currentItem.artist}
							{side === "offer"
								? " \u2014 you are offering this"
								: " \u2014 you want this"}
						</DialogDescription>
					)}
				</DialogHeader>

				{/* Quality grade selection */}
				<div className="space-y-3">
					<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
						Condition Grade
					</label>
					<div className="flex flex-wrap gap-1.5">
						{QUALITY_GRADES.map((grade) => (
							<button
								key={grade}
								type="button"
								onClick={() => setDeclaredQuality(grade)}
								className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
									declaredQuality === grade
										? "bg-primary text-primary-foreground"
										: "bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline"
								}`}
							>
								{grade}
							</button>
						))}
					</div>
				</div>

				{/* Condition notes */}
				<div className="space-y-2">
					<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
						Condition Notes{" "}
						<span className="text-muted-foreground/40">(optional)</span>
					</label>
					<textarea
						value={conditionNotes}
						onChange={(e) => setConditionNotes(e.target.value.slice(0, 500))}
						placeholder="Any notes about the condition..."
						rows={3}
						maxLength={500}
						className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors resize-none"
					/>
					<p className="text-right text-[10px] text-muted-foreground/40 font-mono">
						{conditionNotes.length}/500
					</p>
				</div>

				<DialogFooter>
					<Button
						variant="ghost"
						onClick={onClose}
					>
						Cancel
					</Button>
					<Button
						disabled={!declaredQuality}
						onClick={() => {
							if (currentItem && declaredQuality) {
								onConfirm(currentItem, {
									declaredQuality,
									conditionNotes: conditionNotes.trim() || undefined,
								});
								// Reset
								setDeclaredQuality("");
								setConditionNotes("");
							}
						}}
					>
						<span className="material-symbols-outlined text-base mr-1">
							add_circle
						</span>
						Add to Proposal
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
