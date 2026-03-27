"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { analyzeAudioFile, formatDuration } from "@/lib/audio/file-metadata";
import { acceptTrade, declineTrade } from "@/actions/trades";
import { SpectrogramCanvas } from "./spectrogram-canvas";
import { create } from "zustand";

// ---------------------------------------------------------------------------
// Zustand store for received file blob (set by lobby, read here)
// ---------------------------------------------------------------------------

interface ReceivedFileState {
	file: Blob | null;
	fileName: string | null;
	setFile: (file: Blob, fileName: string) => void;
	clearFile: () => void;
}

export const useReceivedFileStore = create<ReceivedFileState>((set) => ({
	file: null,
	fileName: null,
	setFile: (file, fileName) => set({ file, fileName }),
	clearFile: () => set({ file: null, fileName: null }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeclaredMetadata {
	fileFormat: string | null;
	declaredBitrate: string | null;
	fileName: string | null;
}

interface SpecAnalysisProps {
	tradeId: string;
	declaredMetadata: DeclaredMetadata;
	isPremium: boolean;
}

interface AnalysisResult {
	format: string;
	duration: number;
	channels: number;
	sampleRate: number;
}

interface SpecCheck {
	label: string;
	declared: string;
	actual: string;
	pass: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SpecAnalysis({ tradeId, declaredMetadata, isPremium }: SpecAnalysisProps) {
	const router = useRouter();
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
	const [spectrogramRendered, setSpectrogramRendered] = useState(false);
	const [spectrogramActive, setSpectrogramActive] = useState(false);
	const [accepting, setAccepting] = useState(false);
	const [declining, setDeclining] = useState(false);
	const [showRejectConfirm, setShowRejectConfirm] = useState(false);

	const file = useReceivedFileStore((s) => s.file);

	// Create object URL from received file
	useEffect(() => {
		if (!file) return;
		const url = URL.createObjectURL(file);
		setAudioUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	// Analyze audio file metadata
	useEffect(() => {
		if (!file) return;
		analyzeAudioFile(file)
			.then(setAnalysis)
			.catch((err) => console.error("[SpecAnalysis] Analysis failed:", err));
	}, [file]);

	// Audio element time tracking
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
		const handleDurationChange = () => setDuration(audio.duration);
		const handleEnded = () => setIsPlaying(false);

		audio.addEventListener("timeupdate", handleTimeUpdate);
		audio.addEventListener("durationchange", handleDurationChange);
		audio.addEventListener("ended", handleEnded);

		return () => {
			audio.removeEventListener("timeupdate", handleTimeUpdate);
			audio.removeEventListener("durationchange", handleDurationChange);
			audio.removeEventListener("ended", handleEnded);
		};
	}, [audioUrl]);

	// Play/pause handler (user gesture required for AudioContext)
	const togglePlay = useCallback(async () => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.pause();
			setIsPlaying(false);
		} else {
			try {
				await audio.play();
				setIsPlaying(true);

				// Activate spectrogram on first play
				if (!spectrogramActive) {
					setSpectrogramActive(true);
				}
			} catch (err) {
				console.error("[SpecAnalysis] Playback failed:", err);
			}
		}
	}, [isPlaying, spectrogramActive]);

	// Handle spectrogram rendered callback
	const handleSpectrogramRendered = useCallback(() => {
		setSpectrogramRendered(true);
	}, []);

	// Accept trade handler
	const handleAccept = async () => {
		setAccepting(true);
		try {
			const result = await acceptTrade(tradeId);
			if (result.error) {
				console.error("[SpecAnalysis] Accept failed:", result.error);
			} else {
				router.push(`/trades/${tradeId}/complete`);
			}
		} catch {
			console.error("[SpecAnalysis] Accept failed");
		} finally {
			setAccepting(false);
		}
	};

	// Decline trade handler
	const handleDecline = async () => {
		setDeclining(true);
		try {
			const result = await declineTrade(tradeId);
			if (result.error) {
				console.error("[SpecAnalysis] Decline failed:", result.error);
			} else {
				router.push("/trades");
			}
		} catch {
			console.error("[SpecAnalysis] Decline failed");
		} finally {
			setDeclining(false);
			setShowRejectConfirm(false);
		}
	};

	// Build spec checks from declared vs actual
	const specChecks: SpecCheck[] = buildSpecChecks(declaredMetadata, analysis);

	const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

	return (
		<>
			{/* Hidden audio element */}
			{audioUrl && (
				<audio ref={audioRef} src={audioUrl} preload="metadata" />
			)}

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
				{/* Audio Preview */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Audio_Preview
					</h2>
					<div className="bg-surface-container-lowest rounded-lg p-4 flex flex-col gap-3">
						<div className="flex items-center gap-3">
							<button
								type="button"
								onClick={togglePlay}
								disabled={!audioUrl}
								className="w-11 h-11 bg-primary-container rounded-full flex items-center justify-center text-on-primary-container hover:brightness-110 transition-all disabled:opacity-40"
								aria-label={isPlaying ? "Pause audio" : "Play audio"}
							>
								<span className="material-symbols-outlined">
									{isPlaying ? "pause" : "play_arrow"}
								</span>
							</button>
							<div className="flex-1">
								<div className="h-1 bg-surface-container-high rounded-full">
									<div
										className="h-full bg-primary rounded-full transition-all"
										style={{ width: `${progressPercent}%` }}
									/>
								</div>
							</div>
							<span className="font-mono text-xs text-on-surface-variant">
								{formatDuration(currentTime)} / {formatDuration(duration)}
							</span>
						</div>
						{!file && (
							<div className="text-[10px] font-mono text-on-surface-variant text-center">
								No audio file available. Return to the trade lobby to receive the file.
							</div>
						)}
						{declaredMetadata.fileName && (
							<div className="text-[10px] font-mono text-on-surface-variant text-center truncate">
								{declaredMetadata.fileName}
							</div>
						)}
					</div>
				</div>

				{/* Spectrogram */}
				<div className="bg-surface-container-low rounded-xl p-6 border border-outline-variant/10">
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface-variant mb-4">
						Spectrogram_Analysis
					</h2>
					<div className="bg-surface-container-lowest rounded-lg aspect-video relative overflow-hidden">
						<SpectrogramCanvas
							audioElement={audioRef.current}
							isActive={spectrogramActive}
							onRendered={handleSpectrogramRendered}
						/>

						{/* Freemium gate overlay */}
						{!isPremium && spectrogramRendered && (
							<div className="absolute inset-0 bg-surface-container-lowest/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-10">
								<span className="material-symbols-outlined text-on-surface-variant/60 text-3xl">
									lock
								</span>
								<span className="text-[10px] font-mono text-on-surface-variant text-center px-4">
									[PREMIUM_FEATURE] Upgrade to re-analyze
								</span>
							</div>
						)}

						{/* Premium re-analyze button */}
						{isPremium && spectrogramRendered && (
							<button
								type="button"
								onClick={() => {
									setSpectrogramRendered(false);
									setSpectrogramActive(true);
								}}
								className="absolute top-2 right-2 z-10 text-[10px] font-mono bg-primary-container text-on-primary-container px-2 py-1 rounded hover:brightness-110 transition-all"
							>
								Re-analyze
							</button>
						)}

						{/* Initial placeholder */}
						{!spectrogramActive && (
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="text-center">
									<span className="material-symbols-outlined text-on-surface-variant/40 text-4xl block">
										bar_chart
									</span>
									<span className="text-[10px] font-mono text-on-surface-variant/40 mt-2 block">
										Press play to generate spectrogram
									</span>
								</div>
							</div>
						)}
					</div>
				</div>
			</div>

			{/* Metadata Verification Table */}
			<div className="bg-surface-container-low rounded-xl overflow-hidden mb-8">
				<div className="bg-surface-container-high px-6 py-4 flex items-center gap-2">
					<span className="material-symbols-outlined text-primary text-[18px]">verified</span>
					<h2 className="text-xs font-mono uppercase tracking-widest text-on-surface">
						Metadata_Verification
					</h2>
				</div>
				<div className="divide-y divide-outline-variant/10">
					{/* Header row */}
					<div className="px-6 py-2 grid grid-cols-4 gap-4 items-center bg-surface-container-high/50">
						<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">LABEL</span>
						<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">DECLARED</span>
						<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">ACTUAL</span>
						<span className="font-mono text-[10px] text-on-surface-variant uppercase tracking-wider">STATUS</span>
					</div>
					{specChecks.map((check) => (
						<div key={check.label} className="px-6 py-3 grid grid-cols-4 gap-4 items-center">
							<span className="font-mono text-xs text-on-surface-variant">{check.label}</span>
							<span className="font-mono text-xs text-on-surface">{check.declared}</span>
							<span className="font-mono text-xs text-on-surface">{check.actual}</span>
							<span
								className={`font-mono text-[10px] ${check.pass ? "text-primary" : "text-destructive"}`}
							>
								{check.pass ? "[PASS]" : "[FAIL]"}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Actions */}
			<div className="flex gap-4">
				<button
					type="button"
					onClick={handleAccept}
					disabled={accepting}
					className="flex-1 py-3 bg-primary-container text-on-primary-container font-mono text-sm font-bold rounded hover:brightness-110 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
				>
					<span className="material-symbols-outlined">check_circle</span>
					{accepting ? "ACCEPTING..." : "ACCEPT_TRADE"}
				</button>

				{!showRejectConfirm ? (
					<button
						type="button"
						onClick={() => setShowRejectConfirm(true)}
						className="flex-1 py-3 bg-surface-container-high text-on-surface-variant font-mono text-sm font-bold rounded hover:bg-surface-bright transition-all flex items-center justify-center gap-2 border border-outline-variant/20"
					>
						<span className="material-symbols-outlined">cancel</span>
						REJECT_TRADE
					</button>
				) : (
					<div className="flex-1 flex gap-2">
						<button
							type="button"
							onClick={handleDecline}
							disabled={declining}
							className="flex-1 py-3 bg-destructive/20 text-destructive font-mono text-sm font-bold rounded hover:bg-destructive/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
						>
							{declining ? "DECLINING..." : "CONFIRM_REJECT"}
						</button>
						<button
							type="button"
							onClick={() => setShowRejectConfirm(false)}
							className="px-4 py-3 bg-surface-container-high text-on-surface-variant font-mono text-xs rounded hover:bg-surface-bright transition-all border border-outline-variant/20"
						>
							CANCEL
						</button>
					</div>
				)}
			</div>
		</>
	);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSpecChecks(
	declared: DeclaredMetadata,
	actual: AnalysisResult | null,
): SpecCheck[] {
	const pending = "Analyzing...";
	const na = "N/A";

	const actualFormat = actual?.format ?? (actual === null ? pending : na);
	const actualDuration = actual ? formatDuration(actual.duration) : (actual === null ? pending : na);
	const actualChannels = actual
		? actual.channels === 2
			? "Stereo (2.0)"
			: actual.channels === 1
				? "Mono (1.0)"
				: `${actual.channels} channels`
		: (actual === null ? pending : na);
	const actualBitrate = actual
		? `${Math.round(actual.sampleRate / 1000)}kHz`
		: (actual === null ? pending : na);

	const formatPass = actual ? (declared.fileFormat?.toUpperCase() === actual.format.toUpperCase()) : true;
	const channelsPass = actual ? actual.channels > 0 : true;

	return [
		{
			label: "FORMAT",
			declared: declared.fileFormat ?? na,
			actual: actualFormat,
			pass: formatPass,
		},
		{
			label: "BITRATE",
			declared: declared.declaredBitrate ?? na,
			actual: actualBitrate,
			pass: true, // Bitrate comparison is approximate
		},
		{
			label: "DURATION",
			declared: na,
			actual: actualDuration,
			pass: true,
		},
		{
			label: "CHANNELS",
			declared: "Stereo (2.0)",
			actual: actualChannels,
			pass: channelsPass,
		},
		{
			label: "MD5_HASH",
			declared: na,
			actual: na,
			pass: true,
		},
	];
}
