"use client";

interface GenreData {
	genre: string;
	count: number;
}

interface DnaRadarChartProps {
	genres: GenreData[];
}

const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 75;
const LEVELS = 4;

const GENRE_COLORS: Record<string, string> = {
	Jazz: "#4ade80",
	Electronic: "#60a5fa",
	Rock: "#f87171",
	"Funk / Soul": "#fbbf24",
	"Hip Hop": "#a78bfa",
	Classical: "#f9a8d4",
	Pop: "#fb923c",
	Reggae: "#34d399",
	Latin: "#f472b6",
	Blues: "#818cf8",
};

function polarToCartesian(angle: number, radius: number): [number, number] {
	const rad = ((angle - 90) * Math.PI) / 180;
	return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

export function DnaRadarChart({ genres }: DnaRadarChartProps) {
	if (genres.length < 3) return null;

	const top = genres.slice(0, 6);
	const maxCount = Math.max(...top.map((g) => g.count), 1);
	const angleStep = 360 / top.length;

	// Build the radar polygon
	const points = top.map((g, i) => {
		const angle = i * angleStep;
		const ratio = g.count / maxCount;
		const r = RADIUS * ratio;
		return polarToCartesian(angle, r);
	});

	const polygonPath = `${points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")}Z`;

	return (
		<div className="bg-surface-container-low rounded-xl p-5 border border-outline-variant/5">
			<h3 className="font-mono text-[10px] text-on-surface-variant uppercase tracking-widest mb-3 flex items-center gap-1.5">
				<span className="material-symbols-outlined text-[14px] text-primary">fingerprint</span>
				Digger DNA
			</h3>

			<div className="flex items-center gap-6">
				{/* SVG radar */}
				<svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="flex-shrink-0">
					<title>Digger DNA radar chart</title>
					{/* Grid rings */}
					{Array.from({ length: LEVELS }).map((_, i) => {
						const r = (RADIUS / LEVELS) * (i + 1);
						const ringPoints = top.map((_, j) => polarToCartesian(j * angleStep, r));
						const ringPath = `${ringPoints.map((p, j) => `${j === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ")}Z`;
						return (
							<path
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={i}
								d={ringPath}
								fill="none"
								stroke="var(--outline-variant)"
								strokeOpacity={0.08}
								strokeWidth={1}
							/>
						);
					})}

					{/* Axis lines */}
					{top.map((_, i) => {
						const [x, y] = polarToCartesian(i * angleStep, RADIUS);
						return (
							<line
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={`axis-${i}`}
								x1={CENTER}
								y1={CENTER}
								x2={x}
								y2={y}
								stroke="var(--outline-variant)"
								strokeOpacity={0.06}
								strokeWidth={1}
							/>
						);
					})}

					{/* Data polygon */}
					<path
						d={polygonPath}
						fill="var(--primary)"
						fillOpacity={0.15}
						stroke="var(--primary)"
						strokeOpacity={0.6}
						strokeWidth={1.5}
					/>

					{/* Data points */}
					{points.map((p, i) => {
						return (
							<circle
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={`point-${i}`}
								cx={p[0]}
								cy={p[1]}
								r={3}
								fill="var(--primary)"
							/>
						);
					})}

					{/* Labels */}
					{top.map((g, i) => {
						const [x, y] = polarToCartesian(i * angleStep, RADIUS + 18);
						return (
							<text
								// biome-ignore lint/suspicious/noArrayIndexKey: static list
								key={`label-${i}`}
								x={x}
								y={y}
								textAnchor="middle"
								dominantBaseline="middle"
								className="font-mono"
								fill="var(--on-surface-variant)"
								fillOpacity={0.5}
								fontSize={8}
							>
								{g.genre.length > 10 ? `${g.genre.slice(0, 10)}…` : g.genre}
							</text>
						);
					})}
				</svg>

				{/* Genre list with percentages */}
				<div className="flex-1 space-y-2">
					{top.map((g) => {
						const pct = Math.round((g.count / maxCount) * 100);
						const color = GENRE_COLORS[g.genre] ?? "var(--primary)";
						return (
							<div key={g.genre} className="flex items-center gap-2">
								<div
									className="w-2 h-2 rounded-full flex-shrink-0"
									style={{ backgroundColor: color }}
								/>
								<span className="font-mono text-[10px] text-on-surface flex-1 truncate">
									{g.genre}
								</span>
								<div className="w-16 h-1 bg-surface-container-high rounded-full overflow-hidden">
									<div
										className="h-full rounded-full"
										style={{ width: `${pct}%`, backgroundColor: color }}
									/>
								</div>
								<span className="font-mono text-[9px] text-on-surface-variant/50 w-8 text-right">
									{g.count}
								</span>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
