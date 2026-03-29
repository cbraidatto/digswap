"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreviewPlayerProps {
	previewBlob: Blob;
	label: string; // e.g., "YOUR_PREVIEW" or "PARTNER_PREVIEW"
	onAdvancedSpectrum?: () => void; // Opens spectrogram modal
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_COUNT = 150;
const BAR_WIDTH = 3;
const BAR_GAP = 1;
const CANVAS_HEIGHT = 100;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PreviewPlayer({
	previewBlob,
	label,
	onAdvancedSpectrum,
}: PreviewPlayerProps) {
	const [amplitudes, setAmplitudes] = useState<number[]>([]);
	const [duration, setDuration] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
	const [decodeError, setDecodeError] = useState(false);
	const audioContextRef = useRef<AudioContext | null>(null);
	const sourceRef = useRef<AudioBufferSourceNode | null>(null);
	const startTimeRef = useRef(0);
	const animFrameRef = useRef(0);
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// -----------------------------------------------------------------------
	// Decode audio and compute amplitude buckets
	// -----------------------------------------------------------------------

	useEffect(() => {
		let cancelled = false;

		const decode = async () => {
			const ctx = new AudioContext();
			audioContextRef.current = ctx;
			const arrayBuffer = await previewBlob.arrayBuffer();

			try {
				const buffer = await ctx.decodeAudioData(arrayBuffer);
				if (cancelled) return;

				setAudioBuffer(buffer);
				setDuration(buffer.duration);

				// Compute amplitude buckets
				const channelData = buffer.getChannelData(0);
				const samplesPerBucket = Math.floor(channelData.length / BAR_COUNT);
				const amps: number[] = [];

				for (let i = 0; i < BAR_COUNT; i++) {
					let max = 0;
					const start = i * samplesPerBucket;
					for (
						let j = start;
						j < start + samplesPerBucket && j < channelData.length;
						j++
					) {
						const abs = Math.abs(channelData[j]);
						if (abs > max) max = abs;
					}
					amps.push(max);
				}
				setAmplitudes(amps);
			} catch (err) {
				console.error("Failed to decode preview audio:", err);
				if (!cancelled) setDecodeError(true);
			}
		};

		decode();

		return () => {
			cancelled = true;
		};
	}, [previewBlob]);

	// -----------------------------------------------------------------------
	// Canvas rendering function
	// -----------------------------------------------------------------------

	const drawWaveform = useCallback(
		(playProgress: number) => {
			const canvas = canvasRef.current;
			if (!canvas || amplitudes.length === 0) return;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const width = BAR_COUNT * (BAR_WIDTH + BAR_GAP);
			canvas.width = width;
			canvas.height = CANVAS_HEIGHT;
			ctx.clearRect(0, 0, width, CANVAS_HEIGHT);

			const playedBars = Math.floor(playProgress * BAR_COUNT);

			// Get CSS custom properties for Ghost Protocol colors
			const styles = getComputedStyle(document.documentElement);
			const primaryColor =
				styles.getPropertyValue("--color-primary").trim() || "#c4a882";
			const surfaceColor =
				styles.getPropertyValue("--color-surface-container").trim() ||
				"#3a3530";

			for (let i = 0; i < amplitudes.length; i++) {
				const barHeight = Math.max(2, amplitudes[i] * CANVAS_HEIGHT * 0.9);
				const x = i * (BAR_WIDTH + BAR_GAP);
				const y = (CANVAS_HEIGHT - barHeight) / 2;

				ctx.fillStyle = i < playedBars ? primaryColor : surfaceColor;
				ctx.fillRect(x, y, BAR_WIDTH, barHeight);
			}
		},
		[amplitudes],
	);

	// -----------------------------------------------------------------------
	// Initial draw on amplitudes change
	// -----------------------------------------------------------------------

	useEffect(() => {
		if (amplitudes.length > 0) drawWaveform(0);
	}, [amplitudes, drawWaveform]);

	// -----------------------------------------------------------------------
	// Playback controls using AudioBufferSourceNode
	// -----------------------------------------------------------------------

	const play = useCallback(() => {
		if (!audioBuffer || !audioContextRef.current) return;
		const ctx = audioContextRef.current;

		// Resume context if suspended (browser autoplay policy)
		if (ctx.state === "suspended") {
			ctx.resume();
		}

		// Stop existing source
		if (sourceRef.current) {
			try {
				sourceRef.current.stop();
			} catch {
				/* already stopped */
			}
		}

		const source = ctx.createBufferSource();
		source.buffer = audioBuffer;
		source.connect(ctx.destination);
		source.start(0, currentTime);
		sourceRef.current = source;
		startTimeRef.current = ctx.currentTime - currentTime;
		setIsPlaying(true);

		source.onended = () => {
			setIsPlaying(false);
			setCurrentTime(0);
			drawWaveform(0);
		};

		// Animation loop for cursor
		const animate = () => {
			if (!audioContextRef.current) return;
			const elapsed =
				audioContextRef.current.currentTime - startTimeRef.current;
			setCurrentTime(elapsed);
			drawWaveform(elapsed / (audioBuffer?.duration ?? 1));
			if (elapsed < (audioBuffer?.duration ?? 0)) {
				animFrameRef.current = requestAnimationFrame(animate);
			}
		};
		animFrameRef.current = requestAnimationFrame(animate);
	}, [audioBuffer, currentTime, drawWaveform]);

	const pause = useCallback(() => {
		if (sourceRef.current) {
			try {
				sourceRef.current.stop();
			} catch {
				/* already stopped */
			}
			sourceRef.current = null;
		}
		if (animFrameRef.current) {
			cancelAnimationFrame(animFrameRef.current);
		}
		setIsPlaying(false);
		// currentTime is preserved for resume
	}, []);

	// -----------------------------------------------------------------------
	// Cleanup on unmount
	// -----------------------------------------------------------------------

	useEffect(() => {
		return () => {
			if (sourceRef.current) {
				try {
					sourceRef.current.stop();
				} catch {
					/* already stopped */
				}
			}
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (audioContextRef.current) void audioContextRef.current.close();
		};
	}, []);

	// -----------------------------------------------------------------------
	// Render
	// -----------------------------------------------------------------------

	if (decodeError) {
		return (
			<div className="w-full">
				<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em] uppercase">
					{label}
				</span>
				<div className="mt-2 bg-surface-container rounded-lg p-4 border border-outline-variant/10">
					<p className="text-xs text-destructive">
						Could not decode preview audio. The file format may not be supported.
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full">
			<span className="text-[10px] font-mono text-on-surface-variant tracking-[0.2em] uppercase">
				{label}
			</span>
			<div className="mt-2 bg-surface-container rounded-lg p-4 border border-outline-variant/10">
				<canvas
					ref={canvasRef}
					className="w-full"
					style={{ height: `${CANVAS_HEIGHT}px` }}
					aria-label={`Waveform for ${label}`}
				/>
				<div className="flex items-center justify-between mt-3">
					<button
						type="button"
						onClick={isPlaying ? pause : play}
						className="px-4 py-1.5 bg-primary text-on-primary text-xs font-mono rounded hover:opacity-90 transition-opacity disabled:opacity-50"
						disabled={!audioBuffer}
					>
						{isPlaying ? "PAUSE" : "PLAY_PREVIEW"}
					</button>
					<span className="text-[10px] font-mono text-on-surface-variant">
						{Math.round(currentTime)}s / {Math.round(duration)}s
					</span>
				</div>
				{onAdvancedSpectrum && (
					<button
						type="button"
						onClick={onAdvancedSpectrum}
						className="mt-2 text-[10px] font-mono text-primary hover:underline"
					>
						ADVANCED_SPECTRUM
					</button>
				)}
			</div>
		</div>
	);
}
