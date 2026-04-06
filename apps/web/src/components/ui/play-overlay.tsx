"use client";

import { PlayButton } from "@/components/player/play-button";

interface PlayOverlayProps {
	videoId: string | null | undefined;
	title: string;
	artist: string;
	coverUrl: string | null | undefined;
}

/**
 * Absolutely-positioned play button overlay for cover art.
 * Appears on hover. Render inside a relative-positioned container.
 * Returns null if no videoId.
 */
export function PlayOverlay({ videoId, title, artist, coverUrl }: PlayOverlayProps) {
	if (!videoId) return null;

	return (
		<div className="absolute inset-0 bg-black/40 rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
			<div className="pointer-events-auto">
				<PlayButton
					videoId={videoId}
					title={title}
					artist={artist}
					coverUrl={coverUrl ?? undefined}
					size="sm"
				/>
			</div>
		</div>
	);
}
