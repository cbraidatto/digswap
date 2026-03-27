"use client";

import { useEffect, useRef, useCallback } from "react";
import { renderSpectrogram } from "@/lib/audio/spectrum-analyzer";

interface SpectrogramCanvasProps {
	audioElement: HTMLAudioElement | null;
	isActive: boolean;
	onRendered?: () => void;
}

export function SpectrogramCanvas({
	audioElement,
	isActive,
	onRendered,
}: SpectrogramCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);
	const hasRenderedRef = useRef(false);
	const prefersReducedMotion = useReducedMotion();

	// Handle spectrogram rendering
	const startSpectrogram = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas || !audioElement) return;

		// Clean up previous instance
		if (cleanupRef.current) {
			cleanupRef.current();
			cleanupRef.current = null;
		}

		// Size canvas to container
		const rect = canvas.getBoundingClientRect();
		canvas.width = rect.width * (window.devicePixelRatio || 1);
		canvas.height = rect.height * (window.devicePixelRatio || 1);

		if (prefersReducedMotion) {
			// Static frequency snapshot for reduced motion
			renderStaticSnapshot(canvas, audioElement);
			hasRenderedRef.current = true;
			onRendered?.();
			return;
		}

		try {
			const { cleanup } = renderSpectrogram(canvas, audioElement);
			cleanupRef.current = cleanup;

			// Notify parent after first render frame
			if (!hasRenderedRef.current) {
				hasRenderedRef.current = true;
				// Delay notification slightly so the spectrogram has drawn at least one frame
				requestAnimationFrame(() => {
					onRendered?.();
				});
			}
		} catch (err) {
			console.error("[SpectrogramCanvas] Failed to render:", err);
		}
	}, [audioElement, prefersReducedMotion, onRendered]);

	// Start/stop spectrogram based on isActive
	useEffect(() => {
		if (isActive && audioElement) {
			startSpectrogram();
		}

		return () => {
			if (cleanupRef.current) {
				cleanupRef.current();
				cleanupRef.current = null;
			}
		};
	}, [isActive, audioElement, startSpectrogram]);

	// Handle resize
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const observer = new ResizeObserver(() => {
			if (isActive && audioElement && !prefersReducedMotion) {
				const rect = canvas.getBoundingClientRect();
				canvas.width = rect.width * (window.devicePixelRatio || 1);
				canvas.height = rect.height * (window.devicePixelRatio || 1);
			}
		});

		observer.observe(canvas);
		return () => observer.disconnect();
	}, [isActive, audioElement, prefersReducedMotion]);

	return (
		<canvas
			ref={canvasRef}
			className="w-full h-full"
			style={{ width: "100%", height: "100%" }}
			aria-label="Audio spectrogram visualization"
		/>
	);
}

// ---------------------------------------------------------------------------
// Reduced motion: static snapshot
// ---------------------------------------------------------------------------

function renderStaticSnapshot(
	canvas: HTMLCanvasElement,
	audioElement: HTMLAudioElement,
) {
	try {
		const audioCtx = new AudioContext();
		const source = audioCtx.createMediaElementSource(audioElement);
		const analyser = audioCtx.createAnalyser();
		analyser.fftSize = 2048;

		source.connect(analyser);
		analyser.connect(audioCtx.destination);

		const bufferLength = analyser.frequencyBinCount;
		const dataArray = new Uint8Array(bufferLength);
		analyser.getByteFrequencyData(dataArray);

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const width = canvas.width;
		const height = canvas.height;
		const barWidth = width / bufferLength;

		ctx.clearRect(0, 0, width, height);

		for (let i = 0; i < bufferLength; i++) {
			const value = dataArray[i];
			const percent = value / 255;
			const barHeight = height * percent;

			const r = Math.round(111 * percent);
			const g = Math.round(221 * percent);
			const b = Math.round(120 * percent);

			ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
			ctx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
		}

		// Clean up
		source.disconnect();
		analyser.disconnect();
		void audioCtx.close();
	} catch (err) {
		console.error("[SpectrogramCanvas] Static snapshot failed:", err);
	}
}

// ---------------------------------------------------------------------------
// prefers-reduced-motion hook
// ---------------------------------------------------------------------------

function useReducedMotion(): boolean {
	const mediaQuery =
		typeof window !== "undefined"
			? window.matchMedia("(prefers-reduced-motion: reduce)")
			: null;

	// Use initial value
	const initialValue = mediaQuery?.matches ?? false;

	// For SSR safety, just return initial value
	// In a full implementation, we'd use useState + useEffect to track changes
	return initialValue;
}
