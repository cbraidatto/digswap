"use client";

import { useState } from "react";
import Image from "next/image";
import { usePlayerStore } from "@/lib/player/store";
import { cn } from "@/lib/utils";

function formatTime(seconds: number): string {
	if (!isFinite(seconds) || seconds < 0) return "0:00";
	const m = Math.floor(seconds / 60);
	const s = Math.floor(seconds % 60);
	return `${m}:${s.toString().padStart(2, "0")}`;
}

export function FloatingPlayer() {
	const [expanded, setExpanded] = useState(false);

	const {
		currentTrack,
		queue,
		volume,
		setVolume,
		isPlaying,
		currentTime,
		duration,
		embedError,
		pause,
		resume,
		next,
		previous,
		removeFromQueue,
	} = usePlayerStore();

	if (!currentTrack) return null;

	const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
	const openYouTube = () => window.open(`https://www.youtube.com/watch?v=${currentTrack.videoId}`, "_blank");

	return (
		<>
			{/* Backdrop when expanded */}
			{expanded && (
				<div
					className="fixed inset-0 bg-black/50 z-40 md:hidden"
					onClick={() => setExpanded(false)}
				/>
			)}

			{/* Player — sits above BottomBar on mobile, above nothing on desktop */}
			<div
				className={cn(
					"fixed left-0 right-0 z-50 transition-all duration-300",
					// On mobile: above bottom nav (h-16 = 64px)
					"bottom-16 md:bottom-0",
					expanded ? "top-auto" : "",
				)}
			>
				{/* Expanded drawer — queue + full controls */}
				{expanded && (
					<div className="bg-surface-container-low border-t border-outline-variant/10 px-4 pt-3 pb-2 max-h-64 overflow-y-auto">
						{/* Now playing header */}
						<div className="flex items-center justify-between mb-2">
							<span className="text-xs text-on-surface-variant font-mono uppercase tracking-wider">Now playing</span>
							<button
								type="button"
								onClick={() => setExpanded(false)}
								className="text-on-surface-variant hover:text-on-surface"
								aria-label="Collapse player"
							>
								<span className="material-symbols-outlined text-lg">keyboard_arrow_down</span>
							</button>
						</div>

						{/* Queue */}
						{queue.length > 0 && (
							<div>
								<span className="text-xs text-on-surface-variant font-mono uppercase tracking-wider">
									Up next ({queue.length})
								</span>
								<div className="mt-1 space-y-1">
									{queue.map((track) => (
										<div
											key={track.videoId}
											className="flex items-center gap-2 p-1.5 rounded hover:bg-surface-container group"
										>
											{track.coverUrl && (
												<Image
													src={track.coverUrl}
													alt={track.title}
													width={28}
													height={28}
													className="rounded flex-shrink-0"
													unoptimized
												/>
											)}
											<div className="flex-1 min-w-0">
												<p className="text-xs text-on-surface truncate">{track.title}</p>
												<p className="text-xs text-on-surface-variant truncate">{track.artist}</p>
											</div>
											<button
												type="button"
												onClick={() => removeFromQueue(track.videoId)}
												className="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-on-surface transition-opacity"
												aria-label="Remove from queue"
											>
												<span className="material-symbols-outlined text-base">close</span>
											</button>
										</div>
									))}
								</div>
							</div>
						)}

						{queue.length === 0 && (
							<p className="text-xs text-on-surface-variant/60 mt-1">
								Give Dig! to records to add them to your queue.
							</p>
						)}
					</div>
				)}

				{/* Mini player bar — always visible when track is loaded */}
				<div
					className="bg-surface-container-low border-t border-outline-variant/10 px-3 py-2"
					style={{ paddingBottom: expanded ? undefined : "env(safe-area-inset-bottom, 0px)" }}
				>
					{/* Embed error state */}
					{embedError ? (
						<div className="flex items-center gap-3">
							<div className="w-8 h-8 rounded bg-surface-container-high flex-shrink-0 flex items-center justify-center">
								<span className="material-symbols-outlined text-base text-on-surface-variant/50">music_off</span>
							</div>
							<div className="flex-1 min-w-0">
								<p className="text-xs text-on-surface truncate">{currentTrack.title}</p>
								<p className="text-xs text-on-surface-variant">Embedding not available</p>
							</div>
							<button
								type="button"
								onClick={openYouTube}
								className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 flex-shrink-0"
							>
								<span className="material-symbols-outlined text-base">open_in_new</span>
								YouTube
							</button>
						</div>
					) : (
						<>
							{/* Progress bar */}
							<div className="h-0.5 rounded-full bg-surface-container-high mb-2 overflow-hidden">
								<div
									className="h-full bg-primary rounded-full transition-all"
									style={{ width: `${progress}%` }}
								/>
							</div>

							{/* Controls row */}
							<div className="flex items-center gap-2">
								{/* Cover */}
								<button
									type="button"
									onClick={() => setExpanded(!expanded)}
									className="flex-shrink-0"
									aria-label={expanded ? "Collapse queue" : "Expand queue"}
								>
									{currentTrack.coverUrl ? (
										<Image
											src={currentTrack.coverUrl}
											alt={currentTrack.title}
											width={36}
											height={36}
											className="rounded"
											unoptimized
										/>
									) : (
										<div className="w-9 h-9 rounded bg-surface-container-high flex items-center justify-center">
											<span className="material-symbols-outlined text-base text-on-surface-variant/50">album</span>
										</div>
									)}
								</button>

								{/* Track info */}
								<button
									type="button"
									onClick={() => setExpanded(!expanded)}
									className="flex-1 min-w-0 text-left"
								>
									<p className="text-sm font-medium text-on-surface truncate leading-tight">
										{currentTrack.title}
									</p>
									<p className="text-xs text-on-surface-variant truncate">
										{currentTrack.artist}
									</p>
								</button>

								{/* Time */}
								<span className="text-xs text-on-surface-variant tabular-nums flex-shrink-0 hidden sm:block">
									{formatTime(currentTime)} / {formatTime(duration)}
								</span>

								{/* Controls */}
								<div className="flex items-center gap-1 flex-shrink-0">
									<button
										type="button"
										onClick={previous}
										className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors"
										aria-label="Previous"
									>
										<span className="material-symbols-outlined text-lg">skip_previous</span>
									</button>

									<button
										type="button"
										onClick={isPlaying ? pause : resume}
										className="p-1.5 text-on-surface hover:text-primary transition-colors"
										aria-label={isPlaying ? "Pause" : "Play"}
									>
										<span className="material-symbols-outlined text-2xl">
											{isPlaying ? "pause" : "play_arrow"}
										</span>
									</button>

									<button
										type="button"
										onClick={next}
										className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors"
										aria-label="Next"
									>
										<span className="material-symbols-outlined text-lg">skip_next</span>
									</button>

									{/* Queue indicator */}
									<button
										type="button"
										onClick={() => setExpanded(!expanded)}
										className={cn(
											"p-1.5 transition-colors relative",
											expanded ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
										)}
										aria-label="Show queue"
									>
										<span className="material-symbols-outlined text-lg">queue_music</span>
										{queue.length > 0 && (
											<span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-primary text-on-primary text-[9px] font-bold flex items-center justify-center">
												{queue.length > 9 ? "9+" : queue.length}
											</span>
										)}
									</button>

									{/* Volume control */}
									<div className="hidden sm:flex items-center gap-1.5 ml-1">
										<button
											type="button"
											onClick={() => setVolume(volume === 0 ? 80 : 0)}
											className="p-1 text-on-surface-variant hover:text-on-surface transition-colors"
											aria-label={volume === 0 ? "Unmute" : "Mute"}
										>
											<span className="material-symbols-outlined text-lg">
												{volume === 0 ? "volume_off" : volume < 50 ? "volume_down" : "volume_up"}
											</span>
										</button>
										<input
											type="range"
											min={0}
											max={100}
											step={1}
											value={volume}
											onChange={(e) => setVolume(Number(e.target.value))}
											className="w-20 accent-primary h-1 cursor-pointer"
											aria-label="Volume"
										/>
									</div>
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	);
}
