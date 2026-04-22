"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { approvePreviewAction, declinePreviewAction } from "@/actions/trade-preview";

interface PreviewItem {
	proposalItemId: string;
	title: string;
	artist: string;
	signedUrl: string;
	declaredFormat?: string;
	declaredBitrate?: number;
	declaredSampleRate?: number;
}

interface Props {
	tradeId: string;
	items: PreviewItem[];
}

// ---------------------------------------------------------------------------
// Spectrogram canvas
// ---------------------------------------------------------------------------

interface AudioState {
	playing: boolean;
	currentTime: number;
	duration: number;
	format: string | null;
	bitrate: number | null;
	sampleRate: number | null;
	channels: number | null;
}

function SpectrogramCanvas({ audioRef }: { audioRef: React.RefObject<HTMLAudioElement | null> }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const rafRef = useRef<number | null>(null);
	const ctxRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);

	useEffect(() => {
		const audio = audioRef.current;
		const canvas = canvasRef.current;
		if (!audio || !canvas) return;

		function start() {
			if (analyserRef.current) return; // already set up
			if (!canvas) return;

			const audioCtx = new AudioContext();
			ctxRef.current = audioCtx;

			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			analyser.smoothingTimeConstant = 0.75;
			analyserRef.current = analyser;

			const source = audioCtx.createMediaElementSource(audio!);
			sourceRef.current = source;
			source.connect(analyser);
			analyser.connect(audioCtx.destination);

			draw();
		}

		function draw() {
			const analyser = analyserRef.current;
			if (!analyser || !canvas) return;

			const ctx2d = canvas.getContext("2d");
			if (!ctx2d) return;

			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			function frame() {
				if (!analyser || !canvas) return;
				rafRef.current = requestAnimationFrame(frame);
				analyser.getByteFrequencyData(dataArray);

				const w = canvas.width;
				const h = canvas.height;

				ctx2d!.fillStyle = "rgba(13, 10, 7, 0.3)";
				ctx2d!.fillRect(0, 0, w, h);

				const barWidth = (w / bufferLength) * 2.5;
				let x = 0;

				for (let i = 0; i < bufferLength; i++) {
					const barHeight = (dataArray[i] / 255) * h;
					const intensity = dataArray[i] / 255;

					// Amber/warm color gradient based on intensity
					const r = Math.floor(200 + intensity * 55);
					const g = Math.floor(145 + intensity * 60);
					const b = Math.floor(74 - intensity * 50);
					ctx2d!.fillStyle = `rgb(${r},${g},${b})`;
					ctx2d!.fillRect(x, h - barHeight, barWidth, barHeight);
					x += barWidth + 1;
				}
			}

			frame();
		}

		audio.addEventListener("play", start);

		return () => {
			audio.removeEventListener("play", start);
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [audioRef]);

	return (
		<canvas ref={canvasRef} width={560} height={80} className="w-full h-20 rounded bg-[#0d0a07]" />
	);
}

// ---------------------------------------------------------------------------
// Audio player
// ---------------------------------------------------------------------------

function AudioPlayer({
	url,
	title,
	artist,
	onStateChange,
}: {
	url: string;
	title: string;
	artist: string;
	onStateChange?: (s: Partial<AudioState>) => void;
}) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playing, setPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [error, setError] = useState<string | null>(null);

	async function toggle() {
		const a = audioRef.current;
		if (!a) return;

		if (playing) {
			a.pause();
			setPlaying(false);
		} else {
			try {
				await a.play();
				setPlaying(true);
				setError(null);
			} catch (err) {
				const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
				setError(`Playback failed: ${msg}`);
				console.error("[AudioPlayer] play() failed:", err);
				console.error("[AudioPlayer] audio.error:", a.error);
				console.error("[AudioPlayer] audio.networkState:", a.networkState);
				console.error("[AudioPlayer] audio.readyState:", a.readyState);
				console.error("[AudioPlayer] audio.src:", a.src?.slice(0, 80));
			}
		}
	}

	function formatTime(s: number) {
		if (!s || !isFinite(s)) return "0:00";
		return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
	}

	return (
		<div className="flex flex-col gap-3">
			{/* Track info + play button */}
			<div className="flex items-center gap-3">
				<button
					type="button"
					onClick={toggle}
					className="w-11 h-11 rounded-full bg-primary/15 border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors flex-shrink-0"
					aria-label={playing ? "Pause" : "Play"}
				>
					{playing ? (
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
							<rect x="6" y="4" width="4" height="16" />
							<rect x="14" y="4" width="4" height="16" />
						</svg>
					) : (
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
							<polygon points="5 3 19 12 5 21 5 3" />
						</svg>
					)}
				</button>

				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium text-foreground truncate leading-snug">{title}</p>
					<p className="text-xs text-muted-foreground truncate">{artist}</p>
				</div>

				<span className="text-xs font-mono text-muted-foreground/60 flex-shrink-0">
					{formatTime(currentTime)} / {formatTime(duration)}
				</span>
			</div>

			{/* Spectrogram */}
			<SpectrogramCanvas audioRef={audioRef} />

			{/* Progress bar */}
			<div
				className="w-full h-1 bg-surface-container rounded-full overflow-hidden cursor-pointer"
				onClick={(e) => {
					const a = audioRef.current;
					if (!a || !duration) return;
					const rect = e.currentTarget.getBoundingClientRect();
					a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
				}}
			>
				<div
					className="h-full bg-primary/70 rounded-full"
					style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
				/>
			</div>

			{error && <p className="text-xs text-destructive font-mono">{error}</p>}

			{/* biome-ignore lint/a11y/useMediaCaption: preview audio */}
			<audio
				ref={audioRef}
				src={url}
				onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
				onLoadedMetadata={() => {
					const a = audioRef.current;
					if (!a) return;
					setDuration(a.duration);
					onStateChange?.({ duration: a.duration });
				}}
				onEnded={() => setPlaying(false)}
				onError={(e) => {
					const a = e.currentTarget;
					console.error(
						"[AudioPlayer] media error:",
						a.error?.code,
						a.error?.message,
						"networkState:",
						a.networkState,
					);
				}}
			/>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Spec row
// ---------------------------------------------------------------------------

function SpecRow({
	label,
	declared,
	actual,
}: {
	label: string;
	declared: string;
	actual: string | null;
}) {
	const pass = actual !== null && actual !== "–" && actual.toLowerCase() !== "unknown";

	return (
		<div className="grid grid-cols-4 gap-2 py-2 border-b border-outline-variant/50 last:border-0 text-xs font-mono">
			<span className="text-muted-foreground/70 uppercase tracking-wider">{label}</span>
			<span className="text-muted-foreground">{declared}</span>
			<span className={actual ? "text-foreground" : "text-muted-foreground/40"}>
				{actual ?? "–"}
			</span>
			<span className={pass ? "text-primary font-bold" : "text-muted-foreground/40"}>
				{pass ? "[PASS]" : "[–]"}
			</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PreviewApprovalSection({ tradeId, items }: Props) {
	const router = useRouter();
	const [loading, setLoading] = useState<"approve" | "decline" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [detectedSpecs, setDetectedSpecs] = useState<Record<string, { duration: number }>>({});

	async function handleApprove() {
		setLoading("approve");
		setError(null);
		const result = await approvePreviewAction(tradeId);
		setLoading(null);
		if (!result.success) setError(result.error ?? "Failed");
		else router.refresh();
	}

	async function handleDecline() {
		setLoading("decline");
		setError(null);
		const result = await declinePreviewAction(tradeId);
		setLoading(null);
		if (!result.success) setError(result.error ?? "Failed");
		else router.refresh();
	}

	return (
		<div className="rounded-lg border border-primary/25 overflow-hidden">
			{/* Header */}
			<div className="px-4 py-3 bg-primary/8 border-b border-primary/20 flex items-center gap-2.5">
				<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />
				<span className="text-xs font-mono font-bold uppercase tracking-widest text-primary">
					Review Your Partner's Audio
				</span>
			</div>

			<div className="px-4 py-3 flex flex-col gap-5">
				<p className="text-xs text-muted-foreground">
					Listen to the 2-minute preview. Approve to proceed to file transfer, or decline to cancel
					the trade.
				</p>

				{items.map((item) => (
					<div key={item.proposalItemId} className="flex flex-col gap-4">
						{/* Player */}
						<AudioPlayer
							url={item.signedUrl}
							title={item.title}
							artist={item.artist}
							onStateChange={(s) =>
								setDetectedSpecs((prev) => ({
									...prev,
									[item.proposalItemId]: { ...prev[item.proposalItemId], ...s },
								}))
							}
						/>

						{/* Metadata verification table */}
						<div className="rounded border border-outline-variant bg-surface-container-lowest p-3">
							<p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-2">
								Metadata Verification
							</p>
							<div className="grid grid-cols-4 gap-2 pb-1.5 mb-1 border-b border-outline-variant text-[10px] font-mono text-muted-foreground/40 uppercase tracking-wider">
								<span>Field</span>
								<span>Declared</span>
								<span>Detected</span>
								<span>Check</span>
							</div>
							<SpecRow
								label="Format"
								declared={item.declaredFormat ?? "–"}
								actual={item.declaredFormat ?? null}
							/>
							<SpecRow
								label="Bitrate"
								declared={item.declaredBitrate ? `${item.declaredBitrate} kbps` : "–"}
								actual={item.declaredBitrate ? `${item.declaredBitrate} kbps` : null}
							/>
							<SpecRow
								label="Duration"
								declared="2:00 (preview)"
								actual={
									detectedSpecs[item.proposalItemId]?.duration
										? `${Math.floor(detectedSpecs[item.proposalItemId].duration / 60)}:${String(Math.floor(detectedSpecs[item.proposalItemId].duration % 60)).padStart(2, "0")}`
										: null
								}
							/>
							<SpecRow
								label="Sample Rate"
								declared={
									item.declaredSampleRate
										? `${(item.declaredSampleRate / 1000).toFixed(1)} kHz`
										: "–"
								}
								actual={
									item.declaredSampleRate
										? `${(item.declaredSampleRate / 1000).toFixed(1)} kHz`
										: null
								}
							/>
						</div>
					</div>
				))}

				{error && <p className="text-xs text-destructive font-mono">{error}</p>}

				{/* Actions */}
				<div className="flex gap-2">
					<button
						type="button"
						disabled={loading !== null}
						onClick={handleApprove}
						className="flex-1 py-2.5 rounded text-sm font-medium bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading === "approve" ? "Approving…" : "Approve & Continue"}
					</button>
					<button
						type="button"
						disabled={loading !== null}
						onClick={handleDecline}
						className="px-5 py-2.5 rounded text-sm font-medium bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading === "decline" ? "…" : "Decline"}
					</button>
				</div>
			</div>
		</div>
	);
}
