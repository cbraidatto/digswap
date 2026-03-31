/**
 * Renders a scrolling spectrogram on the given canvas from the audio element.
 * Uses AnalyserNode with fftSize 2048, smoothingTimeConstant 0.8.
 * Color gradient maps amplitude 0-255 to Ghost Protocol green.
 *
 * @returns cleanup function, AudioContext, and AnalyserNode for external control.
 */
export function renderSpectrogram(
	canvas: HTMLCanvasElement,
	audioElement: HTMLAudioElement,
): {
	audioCtx: AudioContext;
	analyser: AnalyserNode;
	cleanup: () => void;
} {
	const audioCtx = new AudioContext();
	const source = audioCtx.createMediaElementSource(audioElement);
	const analyser = audioCtx.createAnalyser();

	analyser.fftSize = 2048;
	analyser.smoothingTimeConstant = 0.8;

	source.connect(analyser);
	analyser.connect(audioCtx.destination);

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		throw new Error("Canvas 2D context not available");
	}

	const bufferLength = analyser.frequencyBinCount;
	const dataArray = new Uint8Array(bufferLength);

	let animationId: number | null = null;
	let running = true;

	function draw() {
		if (!running || !ctx) return;
		animationId = requestAnimationFrame(draw);

		analyser.getByteFrequencyData(dataArray);

		const width = canvas.width;
		const height = canvas.height;

		// Shift existing image left by 1 pixel (scrolling spectrogram)
		const imageData = ctx.getImageData(1, 0, width - 1, height);
		ctx.putImageData(imageData, 0, 0);

		// Draw new column on right edge
		const barHeight = height / bufferLength;
		for (let i = 0; i < bufferLength; i++) {
			const value = dataArray[i];
			const percent = value / 255;

			// Ghost Protocol green: map amplitude to RGB
			const r = Math.round(111 * percent);
			const g = Math.round(221 * percent);
			const b = Math.round(120 * percent);

			ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
			// Draw from bottom up (low frequencies at bottom)
			const y = height - (i + 1) * barHeight;
			ctx.fillRect(width - 1, y, 1, barHeight);
		}
	}

	draw();

	function cleanup() {
		running = false;
		if (animationId !== null) {
			cancelAnimationFrame(animationId);
		}
		source.disconnect();
		analyser.disconnect();
		void audioCtx.close();
	}

	return { audioCtx, analyser, cleanup };
}
