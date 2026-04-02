"use client";

import { usePlayerStore, type PlayerTrack } from "@/lib/player/store";
import { cn } from "@/lib/utils";

interface PlayButtonProps {
	videoId: string | null | undefined;
	title: string;
	artist: string;
	coverUrl: string | null | undefined;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function PlayButton({ videoId, title, artist, coverUrl, size = "md", className }: PlayButtonProps) {
	const { play, pause, currentTrack, isPlaying } = usePlayerStore();

	// Don't render if no YouTube video
	if (!videoId) return null;

	const track: PlayerTrack = { videoId, title, artist, coverUrl: coverUrl ?? null };
	const isCurrent = currentTrack?.videoId === videoId;
	const isCurrentlyPlaying = isCurrent && isPlaying;

	function handleClick(e: React.MouseEvent) {
		e.preventDefault();
		e.stopPropagation();

		if (isCurrent && isPlaying) {
			pause();
		} else {
			play(track);
		}
	}

	const sizeClasses = {
		sm: "w-7 h-7",
		md: "w-9 h-9",
		lg: "w-12 h-12",
	};

	const iconSizes = {
		sm: "text-base",
		md: "text-xl",
		lg: "text-2xl",
	};

	return (
		<button
			type="button"
			onClick={handleClick}
			aria-label={isCurrentlyPlaying ? `Pause ${title}` : `Play ${title}`}
			className={cn(
				sizeClasses[size],
				"rounded-full flex items-center justify-center flex-shrink-0 transition-all",
				isCurrent
					? "bg-primary text-on-primary shadow-lg shadow-primary/30"
					: "bg-surface-container-high/80 text-on-surface hover:bg-primary/20 hover:text-primary",
				className,
			)}
		>
			<span
				className={cn("material-symbols-outlined", iconSizes[size])}
				style={isCurrent ? { fontVariationSettings: "'FILL' 1" } : undefined}
			>
				{isCurrentlyPlaying ? "pause" : "play_arrow"}
			</span>
		</button>
	);
}
