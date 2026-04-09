import React, { useEffect, useRef, useState } from "react";

interface Props {
  audioUrl: string;
  width?: number;
  height?: number;
}

type AnalysisState = "loading" | "ready" | "error";

/**
 * Maps a dB amplitude value to an RGB color.
 * -120 dB -> black (#000000)
 * -40 dB  -> amber (#c8914a)
 * 0 dB    -> white (#ffffff)
 */
function amplitudeToColor(dB: number): [number, number, number] {
  const clamped = Math.max(-120, Math.min(0, dB));

  if (clamped <= -40) {
    // Black to amber: -120 to -40
    const t = (clamped + 120) / 80; // 0..1
    return [
      Math.round(t * 0xc8),
      Math.round(t * 0x91),
      Math.round(t * 0x4a),
    ];
  }
  // Amber to white: -40 to 0
  const t = (clamped + 40) / 40; // 0..1
  return [
    Math.round(0xc8 + t * (0xff - 0xc8)),
    Math.round(0x91 + t * (0xff - 0x91)),
    Math.round(0x4a + t * (0xff - 0x4a)),
  ];
}

/** Frequency axis labels: log-spaced from 20 Hz to 20 kHz */
const FREQ_LABELS = [
  { freq: 20, label: "20Hz" },
  { freq: 1000, label: "1kHz" },
  { freq: 10000, label: "10kHz" },
  { freq: 20000, label: "20kHz" },
];

export function SpectralVisualizer({ audioUrl, width = 400, height = 160 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const [state, setState] = useState<AnalysisState>("loading");

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setState("loading");

      let audioContext: AudioContext | null = null;
      try {
        // Fetch audio data
        const response = await fetch(audioUrl);
        if (cancelled) return;
        const arrayBuffer = await response.arrayBuffer();
        if (cancelled) return;

        // Decode audio
        audioContext = new AudioContext();
        audioContextRef.current = audioContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        if (cancelled) return;

        // Run FFT analysis using OfflineAudioContext
        const sampleRate = audioBuffer.sampleRate;
        const length = audioBuffer.length;
        const fftSize = 2048;
        const freqBins = fftSize / 2; // 1024 frequency bins
        const timeSlices = 256;

        const offlineCtx = new OfflineAudioContext(1, length, sampleRate);
        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;

        const analyser = offlineCtx.createAnalyser();
        analyser.fftSize = fftSize;
        analyser.smoothingTimeConstant = 0;

        source.connect(analyser);
        analyser.connect(offlineCtx.destination);
        source.start(0);

        // Build the amplitude matrix by sampling at regular intervals
        const samplesPerSlice = Math.floor(length / timeSlices);
        const matrix: Float32Array[] = [];

        // We need to render the offline context and sample at specific points.
        // OfflineAudioContext processes the entire buffer at once, so we use
        // suspend/resume to sample the analyser at each time slice.
        for (let i = 0; i < timeSlices; i++) {
          const suspendTime = (i * samplesPerSlice) / sampleRate;
          if (suspendTime > 0 && suspendTime < length / sampleRate) {
            offlineCtx.suspend(suspendTime).then(() => {
              const freqData = new Float32Array(freqBins);
              analyser.getFloatFrequencyData(freqData);
              matrix[i] = freqData;
              offlineCtx.resume();
            });
          }
        }

        await offlineCtx.startRendering();
        if (cancelled) return;

        // Fill any missing slices (first slice and edge cases)
        for (let i = 0; i < timeSlices; i++) {
          if (!matrix[i]) {
            matrix[i] = new Float32Array(freqBins).fill(-120);
          }
        }

        // Render to canvas
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        canvas.width = width;
        canvas.height = height;

        const imageData = ctx.createImageData(timeSlices, height);

        for (let x = 0; x < timeSlices; x++) {
          for (let y = 0; y < height; y++) {
            // Map y position to frequency bin (log scale)
            // y=0 is top (high freq), y=height-1 is bottom (low freq)
            const freqFraction = 1 - y / height;
            // Log scale: map 0..1 to log(20)..log(20000)
            const logMin = Math.log(20);
            const logMax = Math.log(20000);
            const freq = Math.exp(logMin + freqFraction * (logMax - logMin));
            const binIndex = Math.min(
              freqBins - 1,
              Math.max(0, Math.round((freq / (sampleRate / 2)) * freqBins))
            );

            const dB = matrix[x][binIndex];
            const [r, g, b] = amplitudeToColor(dB);
            const pixelIndex = (y * timeSlices + x) * 4;
            imageData.data[pixelIndex] = r;
            imageData.data[pixelIndex + 1] = g;
            imageData.data[pixelIndex + 2] = b;
            imageData.data[pixelIndex + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // Scale the image to fill the canvas
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = timeSlices;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.putImageData(imageData, 0, 0);
          canvas.width = width;
          canvas.height = height;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(tempCanvas, 0, 0, width, height);
        }

        // Draw frequency axis labels
        ctx.font = "9px monospace";
        ctx.fillStyle = "#4a4035";
        ctx.textBaseline = "middle";

        for (const { freq, label } of FREQ_LABELS) {
          const logMin = Math.log(20);
          const logMax = Math.log(20000);
          const freqFraction = (Math.log(freq) - logMin) / (logMax - logMin);
          const yPos = Math.round((1 - freqFraction) * height);
          ctx.fillText(label, 4, yPos);
        }

        setState("ready");
      } catch {
        if (!cancelled) {
          setState("error");
        }
      }
    }

    analyze();

    return () => {
      cancelled = true;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [audioUrl, width, height]);

  return (
    <div
      className="relative rounded border border-[#2a2218] bg-[#0d0d0d] overflow-hidden"
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block"
      />

      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[#c8914a] text-xs tracking-widest uppercase animate-pulse">
            Analyzing...
          </span>
        </div>
      )}

      {state === "error" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[#4a4035] text-xs tracking-widest uppercase">
            Analysis failed
          </span>
        </div>
      )}
    </div>
  );
}
