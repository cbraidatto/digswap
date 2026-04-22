"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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

const QUALITY_GRADES = ["Mint", "Near Mint", "VG+", "VG", "Good", "Fair", "Poor"] as const;
const AUDIO_FORMATS = ["WAV", "FLAC", "AIFF", "MP3"] as const;
const BIT_DEPTHS = ["32-bit float", "24-bit", "16-bit"] as const;
const LOSSLESS_FORMATS = new Set(["WAV", "FLAC", "AIFF"]);

function buildDeclaredQuality(grade: string, format: string, depth: string): string {
	if (!format) return grade;
	if (!depth || !LOSSLESS_FORMATS.has(format)) return `${grade} · ${format}`;
	return `${grade} · ${format} ${depth}`;
}

export function QualityDeclarationModal({
	item,
	side,
	onConfirm,
	onClose,
}: QualityDeclarationModalProps) {
	const [grade, setGrade] = useState<string>(item?.conditionGrade ?? "");
	const [audioFormat, setAudioFormat] = useState<string>("");
	const [bitDepth, setBitDepth] = useState<string>("");
	const [conditionNotes, setConditionNotes] = useState("");

	const handleOpenChange = (open: boolean) => {
		if (!open) onClose();
	};

	const showBitDepth = LOSSLESS_FORMATS.has(audioFormat);

	const handleFormatClick = (fmt: string) => {
		if (audioFormat === fmt) {
			setAudioFormat("");
			setBitDepth("");
		} else {
			setAudioFormat(fmt);
			if (!LOSSLESS_FORMATS.has(fmt)) setBitDepth("");
		}
	};

	const handleConfirm = () => {
		if (!item || !grade) return;
		onConfirm(item, {
			declaredQuality: buildDeclaredQuality(grade, audioFormat, bitDepth),
			conditionNotes: conditionNotes.trim() || undefined,
		});
		setGrade("");
		setAudioFormat("");
		setBitDepth("");
		setConditionNotes("");
	};

	return (
		<Dialog open={!!item} onOpenChange={handleOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Declare Quality</DialogTitle>
					{item && (
						<DialogDescription>
							{item.title} by {item.artist}
							{side === "offer" ? " — you are offering this" : " — you want this"}
						</DialogDescription>
					)}
				</DialogHeader>

				<div className="space-y-5">
					{/* Vinyl condition */}
					<div className="space-y-2">
						<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
							Vinyl Condition
						</label>
						<div className="flex flex-wrap gap-1.5">
							{QUALITY_GRADES.map((g) => (
								<button
									key={g}
									type="button"
									onClick={() => setGrade(g)}
									className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
										grade === g
											? "bg-primary text-primary-foreground"
											: "bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline"
									}`}
								>
									{g}
								</button>
							))}
						</div>
					</div>

					{/* Divider */}
					<div className="border-t border-outline-variant" />

					{/* Audio format */}
					<div className="space-y-2">
						<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
							Audio Format <span className="text-muted-foreground/40">(optional)</span>
						</label>
						<div className="flex flex-wrap gap-1.5">
							{AUDIO_FORMATS.map((fmt) => (
								<button
									key={fmt}
									type="button"
									onClick={() => handleFormatClick(fmt)}
									className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
										audioFormat === fmt
											? "bg-primary text-primary-foreground"
											: "bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline"
									}`}
								>
									{fmt}
								</button>
							))}
						</div>
					</div>

					{/* Bit depth — only for lossless */}
					{showBitDepth && (
						<div className="space-y-2">
							<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
								Bit Depth <span className="text-muted-foreground/40">(optional)</span>
							</label>
							<div className="flex flex-wrap gap-1.5">
								{BIT_DEPTHS.map((d) => (
									<button
										key={d}
										type="button"
										onClick={() => setBitDepth(bitDepth === d ? "" : d)}
										className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
											bitDepth === d
												? "bg-primary text-primary-foreground"
												: "bg-surface-container-high text-on-surface border border-outline-variant hover:border-outline"
										}`}
									>
										{d}
									</button>
								))}
							</div>
						</div>
					)}

					{/* Preview badge */}
					{grade && (
						<div className="flex items-center gap-2 px-3 py-2 rounded bg-surface-container-high border border-outline-variant">
							<span className="text-xs font-mono text-muted-foreground">Will appear as:</span>
							<span className="text-xs font-mono font-bold text-foreground">
								{buildDeclaredQuality(grade, audioFormat, bitDepth)}
							</span>
						</div>
					)}

					{/* Condition notes */}
					<div className="space-y-2">
						<label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
							Notes <span className="text-muted-foreground/40">(optional)</span>
						</label>
						<textarea
							value={conditionNotes}
							onChange={(e) => setConditionNotes(e.target.value.slice(0, 500))}
							placeholder="Any notes about the condition or rip..."
							rows={2}
							maxLength={500}
							className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary transition-colors resize-none"
						/>
						<p className="text-right text-[10px] text-muted-foreground/40 font-mono">
							{conditionNotes.length}/500
						</p>
					</div>
				</div>

				<DialogFooter>
					<Button variant="ghost" onClick={onClose}>
						Cancel
					</Button>
					<Button disabled={!grade} onClick={handleConfirm}>
						<span className="material-symbols-outlined text-base mr-1">add_circle</span>
						Add to Proposal
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
