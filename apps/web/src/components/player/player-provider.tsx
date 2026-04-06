"use client";

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/lib/player/store";
import { loadYouTubeAPI, isEmbedBlocked } from "@/lib/player/youtube-api";

/**
 * PlayerProvider — mounts once in the layout.
 * Creates a hidden YouTube IFrame player and syncs it with the Zustand store.
 * The actual UI is in FloatingPlayer, which reads from the same store.
 */
export function PlayerProvider() {
	const playerRef = useRef<YT.Player | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const isMountedRef = useRef(true);

	const {
		currentTrack,
		isPlaying,
		setIsPlaying,
		setCurrentTime,
		setDuration,
		setEmbedError,
		next,
		seekGeneration,
		seekTo,
	} = usePlayerStore();

	// Load YouTube API once on mount
	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	// (Re)create player when currentTrack changes
	useEffect(() => {
		if (!currentTrack) return;

		let progressInterval: ReturnType<typeof setInterval>;

		loadYouTubeAPI().then(() => {
			if (!isMountedRef.current || !containerRef.current) return;

			// Destroy existing player
			if (playerRef.current) {
				try { playerRef.current.destroy(); } catch { /* ignore */ }
				playerRef.current = null;
			}

			// YT.Player replaces the target element with an iframe.
			// After destroy(), the original div is gone from the DOM.
			// We must create a fresh div for the next player instance.
			const playerDiv = document.createElement("div");
			containerRef.current.innerHTML = "";
			containerRef.current.appendChild(playerDiv);

			playerRef.current = new YT.Player(playerDiv, {
				videoId: currentTrack.videoId,
				playerVars: {
					autoplay: 1,
					controls: 0,
					disablekb: 1,
					fs: 0,
					modestbranding: 1,
					rel: 0,
					origin: window.location.origin,
				},
				events: {
					onReady: (e: YT.PlayerEvent) => {
						if (!isMountedRef.current) return;
						setDuration(e.target.getDuration());
						e.target.playVideo();

						// Progress ticker
						progressInterval = setInterval(() => {
							if (!isMountedRef.current || !playerRef.current) return;
							try {
								const time = playerRef.current.getCurrentTime?.() ?? 0;
								setCurrentTime(time);
							} catch { /* ignore */ }
						}, 500);
					},
					onStateChange: (e: YT.OnStateChangeEvent) => {
						if (!isMountedRef.current) return;
						const State = YT.PlayerState;
						if (e.data === State.PLAYING) setIsPlaying(true);
						if (e.data === State.PAUSED) setIsPlaying(false);
						if (e.data === State.ENDED) {
							clearInterval(progressInterval);
							next();
						}
					},
					onError: (e: YT.OnErrorEvent) => {
						if (!isMountedRef.current) return;
						if (isEmbedBlocked(e.data)) {
							setEmbedError(true);
							setIsPlaying(false);
						}
					},
				},
			});
		}).catch(console.error);

		return () => {
			clearInterval(progressInterval);
		};
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentTrack?.videoId]);

	// Sync play/pause to YT player
	useEffect(() => {
		if (!playerRef.current) return;
		try {
			if (isPlaying) {
				playerRef.current.playVideo?.();
			} else {
				playerRef.current.pauseVideo?.();
			}
		} catch { /* ignore */ }
	}, [isPlaying]);

	// Handle seek requests (e.g. "previous" restarts the track)
	useEffect(() => {
		if (!playerRef.current || seekGeneration === 0) return;
		try {
			playerRef.current.seekTo?.(seekTo, true);
		} catch { /* ignore */ }
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seekGeneration]);

	return (
		// Hidden container — the actual YT iframe lives here, visually hidden
		<div
			aria-hidden="true"
			style={{ position: "fixed", bottom: -9999, left: -9999, width: 1, height: 1, overflow: "hidden" }}
		>
			<div ref={containerRef} />
		</div>
	);
}
