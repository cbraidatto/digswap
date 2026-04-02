"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { CONDITION_GRADES } from "@/lib/collection/filters";
import { updateConditionGrade } from "@/actions/collection";

const GRADE_DESCRIPTIONS: Record<string, string> = {
	Mint: "Perfect, unplayed",
	"VG+": "Near perfect, minimal wear",
	VG: "Light surface marks",
	"G+": "Noticeable wear, plays through",
	G: "Heavy wear, still plays",
	F: "Damaged, plays with issues",
	P: "Barely playable",
};

interface ConditionEditorProps {
	collectionItemId: string;
	currentGrade: string | null;
	onGradeUpdated?: (grade: string) => void;
}

export function ConditionEditor({
	collectionItemId,
	currentGrade,
	onGradeUpdated,
}: ConditionEditorProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const [selectedGrade, setSelectedGrade] = useState<string | null>(
		currentGrade,
	);
	const [open, setOpen] = useState(false);

	const handleGradeSelect = async (grade: string) => {
		if (grade === selectedGrade) {
			setOpen(false);
			return;
		}

		setIsUpdating(true);

		try {
			const result = await updateConditionGrade(collectionItemId, grade);

			if ("error" in result && result.error) {
				toast.error(result.error);
			} else {
				setSelectedGrade(grade);
				setOpen(false);
				onGradeUpdated?.(grade);
			}
		} catch (_err) {
			toast.error("Failed to update condition grade.");
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				className="font-mono text-xs px-2 py-0.5 rounded border border-outline-variant/20 hover:bg-surface-container-high transition-colors inline-flex items-center gap-1"
			>
				{isUpdating ? (
					<span className="material-symbols-outlined animate-spin text-[12px] text-primary">
						progress_activity
					</span>
				) : (
					<span className="material-symbols-outlined text-[12px] text-on-surface-variant">
						tune
					</span>
				)}
				<span className={selectedGrade ? "text-on-surface" : "text-on-surface-variant"}>
					{selectedGrade ?? "Grade"}
				</span>
			</PopoverTrigger>
			<PopoverContent className="w-56 p-1.5" align="start" side="top">
				<div className="text-xs font-mono text-on-surface-variant uppercase tracking-widest px-2 py-1.5 mb-0.5">
					Condition Grade
				</div>
				<div className="space-y-0.5">
					{CONDITION_GRADES.map((grade) => {
						const isSelected = selectedGrade === grade;

						return (
							<button
								key={grade}
								type="button"
								onClick={() => handleGradeSelect(grade)}
								disabled={isUpdating}
								className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors disabled:opacity-50 ${
									isSelected
										? "bg-primary/10 text-primary border border-primary/30"
										: "hover:bg-surface-container-high border border-transparent"
								}`}
							>
								<div className="flex items-center gap-2">
									<span className="font-mono text-xs font-medium w-8">
										{grade}
									</span>
									<span className="text-xs text-on-surface-variant">
										{GRADE_DESCRIPTIONS[grade]}
									</span>
								</div>
								{isSelected && (
									<span className="material-symbols-outlined text-primary text-sm">
										check
									</span>
								)}
							</button>
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}
