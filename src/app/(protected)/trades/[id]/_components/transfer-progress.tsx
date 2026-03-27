"use client";

import { formatFileSize } from "@/lib/audio/file-metadata";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TransferProgressProps {
	progress: number; // 0-100
	bytesTransferred: number;
	totalBytes: number;
	speed: number; // bytes/sec
	eta: number; // seconds remaining
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSpeed(bytesPerSec: number): string {
	if (bytesPerSec >= 1024 * 1024) {
		return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB`;
	}
	return `${(bytesPerSec / 1024).toFixed(1)} KB`;
}

function formatEta(seconds: number): string {
	if (seconds >= 60) {
		return `~${Math.ceil(seconds / 60)}m`;
	}
	return `~${Math.ceil(seconds)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TransferProgress({
	progress,
	bytesTransferred,
	totalBytes,
	speed,
	eta,
}: TransferProgressProps) {
	const transferred = formatFileSize(bytesTransferred);
	const total = formatFileSize(totalBytes);
	const speedText = formatSpeed(speed);
	const etaText = formatEta(eta);

	return (
		<div className="bg-surface-container-low rounded-lg p-4 border border-outline-variant/10 w-full">
			{/* Percentage display */}
			<p className="font-mono text-2xl font-bold font-heading text-primary mb-2">
				{progress}%
			</p>

			{/* Progress bar */}
			<div
				className="h-2 bg-surface-container-high rounded-full overflow-hidden"
				role="progressbar"
				aria-valuenow={progress}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label={`Transfer progress: ${progress}%`}
			>
				<div
					className="h-full bg-primary rounded-full transition-all duration-300 motion-reduce:transition-none"
					style={{ width: `${progress}%` }}
				/>
			</div>

			{/* Stats row */}
			<p className="font-mono text-[10px] text-on-surface-variant mt-2">
				{transferred} / {total} {"\u00B7"} {speedText}/s {"\u00B7"}{" "}
				{etaText} remaining
			</p>
		</div>
	);
}
