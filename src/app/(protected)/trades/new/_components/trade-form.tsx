"use client";

import { useState, useRef, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createTrade } from "@/actions/trades";
import {
	TRADE_EXPIRY_OPTIONS,
	DEFAULT_EXPIRY_HOURS,
	ACCEPTED_AUDIO_TYPES,
} from "@/lib/trades/constants";
import { formatFileSize } from "@/lib/audio/file-metadata";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TradeFormProps {
	toUserId: string | null;
	releaseId: string | null;
	counterpartyUsername: string | null;
	counterpartyAvatar: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LARGE_FILE_THRESHOLD = 500 * 1024 * 1024; // 500MB

const AUDIO_ACCEPT = ACCEPTED_AUDIO_TYPES.join(",");

function detectFormat(mimeType: string): string {
	const map: Record<string, string> = {
		"audio/flac": "FLAC",
		"audio/wav": "WAV",
		"audio/mp3": "MP3",
		"audio/mpeg": "MP3",
		"audio/ogg": "OGG",
		"audio/aac": "AAC",
	};
	return map[mimeType] || mimeType.replace("audio/", "").toUpperCase();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TradeForm({
	toUserId,
	releaseId,
	counterpartyUsername,
	counterpartyAvatar,
	releaseTitle,
	releaseArtist,
}: TradeFormProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	// File state
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Metadata
	const [fileFormat, setFileFormat] = useState("");
	const [bitrate, setBitrate] = useState("");

	// Expiry
	const [expiryHours, setExpiryHours] = useState(DEFAULT_EXPIRY_HOURS);

	// Message
	const [message, setMessage] = useState("");

	// -----------------------------------------------------------------------
	// File handling
	// -----------------------------------------------------------------------

	const handleFileSelect = useCallback((file: File) => {
		setSelectedFile(file);
		setFileFormat(detectFormat(file.type));
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragOver(false);
			const file = e.dataTransfer.files[0];
			if (file) handleFileSelect(file);
		},
		[handleFileSelect],
	);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const handleDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) handleFileSelect(file);
		},
		[handleFileSelect],
	);

	const handleDropZoneKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				fileInputRef.current?.click();
			}
		},
		[],
	);

	// -----------------------------------------------------------------------
	// Submit
	// -----------------------------------------------------------------------

	const canSubmit = selectedFile && toUserId && !isPending;

	const handleSubmit = useCallback(() => {
		if (!selectedFile || !toUserId) return;

		startTransition(async () => {
			const result = await createTrade({
				providerId: toUserId,
				releaseId: releaseId ?? undefined,
				fileName: selectedFile.name,
				fileFormat: fileFormat || detectFormat(selectedFile.type),
				declaredBitrate: bitrate || "unknown",
				fileSizeBytes: selectedFile.size,
				expiryHours,
				message: message.trim() || undefined,
			});

			if (result.error) {
				toast.error(result.error);
				return;
			}

			toast.success("Trade request sent");
			router.push("/trades");
		});
	}, [
		selectedFile,
		toUserId,
		releaseId,
		fileFormat,
		bitrate,
		expiryHours,
		message,
		router,
	]);

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	return (
		<>
			{/* Two-column grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				{/* Your_Offer card */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Your_Offer
					</h2>

					{/* File drop zone */}
					<div
						className={`rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors min-h-[120px] ${
							selectedFile
								? "border-2 border-solid border-primary/30 bg-surface-container-lowest"
								: isDragOver
									? "border-2 border-dashed border-primary/50 bg-primary/5"
									: "border-2 border-dashed border-outline-variant/30 hover:border-primary/30"
						}`}
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						onClick={() => fileInputRef.current?.click()}
						onKeyDown={handleDropZoneKeyDown}
						role="button"
						tabIndex={0}
						aria-label="Select audio file to upload"
					>
						<input
							ref={fileInputRef}
							type="file"
							accept="audio/*"
							onChange={handleInputChange}
							className="hidden"
						/>

						{selectedFile ? (
							<>
								<span className="material-symbols-outlined text-primary text-3xl">
									audio_file
								</span>
								<div className="text-center">
									<div className="text-xs font-mono text-on-surface font-bold truncate max-w-[200px]">
										{selectedFile.name}
									</div>
									<div className="text-[10px] font-mono text-on-surface-variant mt-1">
										{detectFormat(selectedFile.type)} &middot;{" "}
										{formatFileSize(selectedFile.size)}
									</div>
									{selectedFile.size >= LARGE_FILE_THRESHOLD && (
										<div className="text-[10px] font-mono text-yellow-400 mt-1">
											Large file &mdash; transfer may take a while
										</div>
									)}
								</div>
							</>
						) : (
							<>
								<span className="material-symbols-outlined text-on-surface-variant/40 text-4xl">
									add_circle
								</span>
								<span className="text-xs font-mono text-on-surface-variant">
									DROP_AUDIO_FILE_HERE
								</span>
								<span className="text-[10px] font-mono text-on-surface-variant/60">
									FLAC, WAV, MP3, OGG, AAC
								</span>
							</>
						)}
					</div>

					{/* Metadata fields */}
					{selectedFile && (
						<div className="mt-4 space-y-3">
							<div>
								<label className="text-[10px] font-mono text-on-surface-variant uppercase block mb-1">
									FORMAT
								</label>
								<input
									type="text"
									value={fileFormat}
									onChange={(e) => setFileFormat(e.target.value)}
									className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface focus:border-primary/40 focus:outline-none"
								/>
							</div>
							<div>
								<label className="text-[10px] font-mono text-on-surface-variant uppercase block mb-1">
									BITRATE
								</label>
								<input
									type="text"
									value={bitrate}
									onChange={(e) => setBitrate(e.target.value)}
									placeholder="e.g. 320kbps, 16/44.1"
									className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none"
								/>
							</div>
						</div>
					)}
				</div>

				{/* Request_From card */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Request_From
					</h2>

					{toUserId ? (
						<div className="bg-surface-container-lowest rounded-lg p-4 border-l-4 border-primary/20">
							<div className="flex items-center gap-3 mb-3">
								{counterpartyAvatar ? (
									<img
										src={counterpartyAvatar}
										alt={counterpartyUsername || "user"}
										className="w-8 h-8 rounded object-cover"
									/>
								) : (
									<div className="w-8 h-8 rounded bg-surface-container-high flex items-center justify-center">
										<span className="text-xs font-mono font-bold text-primary">
											{(counterpartyUsername || "?")
												.charAt(0)
												.toUpperCase()}
										</span>
									</div>
								)}
								<div className="text-xs font-mono text-on-surface font-bold">
									{counterpartyUsername || "Unknown user"}
								</div>
							</div>
							<div className="text-xs font-mono text-on-surface-variant">
								TARGET_USER:{" "}
								<span className="text-primary">
									{counterpartyUsername || toUserId.substring(0, 8)}
								</span>
							</div>
							{releaseTitle && (
								<div className="text-xs font-mono text-on-surface-variant mt-1">
									REQUESTED_ITEM:{" "}
									<span className="text-secondary">
										{releaseTitle}
										{releaseArtist && ` by ${releaseArtist}`}
									</span>
								</div>
							)}
						</div>
					) : (
						<div className="bg-surface-container-lowest rounded-lg p-8 flex flex-col items-center justify-center gap-3 border border-outline-variant/10 text-center">
							<span className="material-symbols-outlined text-on-surface-variant/40 text-3xl">
								person_search
							</span>
							<div className="text-xs font-mono text-on-surface-variant">
								NO_RECIPIENT_SELECTED
							</div>
							<p className="text-[10px] font-mono text-on-surface-variant/60 max-w-[200px]">
								Navigate from a user profile or explorar to pre-fill recipient
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Proposal_Expiry */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Proposal_Expiry
				</h2>
				<div className="flex items-center gap-4">
					{TRADE_EXPIRY_OPTIONS.map((option) => (
						<button
							type="button"
							key={option.value}
							onClick={() => setExpiryHours(option.value)}
							className={`px-4 py-2 rounded font-mono text-xs font-bold transition-all ${
								expiryHours === option.value
									? "bg-primary-container text-on-primary-container"
									: "bg-surface-container-high text-on-surface-variant hover:text-on-surface border border-outline-variant/20"
							}`}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			{/* Optional message */}
			<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10 mb-8">
				<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
					Message (optional)
				</h2>
				<textarea
					value={message}
					onChange={(e) => setMessage(e.target.value)}
					placeholder="Add a note to the trade request..."
					rows={3}
					className="w-full bg-surface-container-lowest border border-outline-variant/20 rounded px-3 py-2 font-mono text-xs text-on-surface placeholder:text-on-surface-variant/40 focus:border-primary/40 focus:outline-none resize-none"
				/>
			</div>

			{/* Send button */}
			<button
				type="button"
				disabled={!canSubmit}
				onClick={handleSubmit}
				className="w-full bg-primary-container text-on-primary-container py-3 font-mono text-sm font-bold rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
			>
				{isPending ? "SENDING..." : "SEND_TRADE_REQUEST"}
			</button>
		</>
	);
}
