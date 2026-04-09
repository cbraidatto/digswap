interface WaveformDecorationProps {
	releaseId: string;
	barCount?: number;
	className?: string;
}

/**
 * Deterministic decorative waveform generated from a release ID hash.
 * Purely visual — no audio data involved.
 */
export function WaveformDecoration({
	releaseId,
	barCount = 48,
	className = "",
}: WaveformDecorationProps) {
	// Simple hash from string to seed
	let hash = 0;
	for (let i = 0; i < releaseId.length; i++) {
		hash = (hash * 31 + releaseId.charCodeAt(i)) | 0;
	}

	// Seeded pseudo-random: integer-only to avoid server/client float divergence
	function seededInt(seed: number, index: number): number {
		let t = (seed + index * 0x6d2b79f5) | 0;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) % 1000;
	}

	const barWidth = 2;
	const gap = 1;
	const svgWidth = barCount * (barWidth + gap);
	const svgHeight = 24;

	return (
		<svg
			width="100%"
			height={svgHeight}
			viewBox={`0 0 ${svgWidth} ${svgHeight}`}
			preserveAspectRatio="none"
			className={`opacity-40 ${className}`}
			aria-hidden="true"
		>
			{Array.from({ length: barCount }, (_, i) => {
				// Envelope: higher in middle — use integer approximation
				const mid = barCount / 2;
				const dist = Math.abs(i - mid) / mid; // 0..1
				const envelopePercent = Math.round((1 - dist * dist) * 60 + 40); // 40..100
				const randPercent = (seededInt(hash, i) % 70) + 30; // 30..99
				const barH = Math.max(2, Math.round((randPercent * envelopePercent * svgHeight) / 10000));
				const y = Math.round((svgHeight - barH) / 2);
				const barKey = `bar-${i}`;
				return (
					<rect
						key={barKey}
						x={i * (barWidth + gap)}
						y={y}
						width={barWidth}
						height={barH}
						rx={1}
						fill="currentColor"
					/>
				);
			})}
		</svg>
	);
}
