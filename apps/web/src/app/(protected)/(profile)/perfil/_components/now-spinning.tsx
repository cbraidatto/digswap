"use client";

import Image from "next/image";
import { usePlayerStore } from "@/lib/player/store";

export function NowSpinning() {
	const currentTrack = usePlayerStore((s) => s.currentTrack);
	const isPlaying = usePlayerStore((s) => s.isPlaying);

	if (!currentTrack) return null;

	return (
		<div className="flex items-center gap-3 bg-surface-container-low/80 backdrop-blur-sm rounded-full pl-1 pr-4 py-1 border border-outline-variant/10">
			{/* Spinning vinyl animation */}
			<div
				className={`relative w-8 h-8 flex-shrink-0 ${isPlaying ? "animate-[spin_3s_linear_infinite]" : ""}`}
			>
				{currentTrack.coverUrl ? (
					<Image
						src={currentTrack.coverUrl}
						alt=""
						width={32}
						height={32}
						unoptimized
						className="w-8 h-8 rounded-full object-cover border border-outline-variant/20"
					/>
				) : (
					<div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/20 flex items-center justify-center">
						<div className="w-2 h-2 rounded-full bg-primary" />
					</div>
				)}
				{/* Center hole */}
				<div className="absolute inset-0 flex items-center justify-center">
					<div className="w-1.5 h-1.5 rounded-full bg-surface-dim" />
				</div>
			</div>

			{/* Track info */}
			<div className="min-w-0">
				<p className="font-mono text-[10px] text-primary truncate leading-tight">
					{isPlaying ? "Now spinning" : "Paused"}
				</p>
				<p className="font-mono text-[10px] text-on-surface truncate leading-tight">
					{currentTrack.title}
				</p>
			</div>

			{/* Pulse indicator when playing */}
			{isPlaying && (
				<div className="flex items-center gap-0.5 flex-shrink-0">
					{[1, 2, 3].map((i) => (
						<div
							key={i}
							className="w-0.5 bg-primary rounded-full animate-pulse"
							style={{
								height: `${8 + Math.random() * 8}px`,
								animationDelay: `${i * 150}ms`,
								animationDuration: `${600 + i * 200}ms`,
							}}
						/>
					))}
				</div>
			)}
		</div>
	);
}
