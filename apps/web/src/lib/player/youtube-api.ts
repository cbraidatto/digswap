/**
 * YouTube IFrame Player API loader.
 * Loads the script once and resolves when the API is ready.
 * Safe to call multiple times — returns the same promise.
 *
 * Requires @types/youtube for YT namespace types.
 */

let ytApiPromise: Promise<void> | null = null;

export function loadYouTubeAPI(): Promise<void> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("YouTube API is browser-only"));
	}

	// Already loaded
	if (window.YT?.Player) {
		return Promise.resolve();
	}

	// Already loading
	if (ytApiPromise) return ytApiPromise;

	ytApiPromise = new Promise((resolve, reject) => {
		const existing = (window as Window & { onYouTubeIframeAPIReady?: () => void })
			.onYouTubeIframeAPIReady;

		(window as Window & { onYouTubeIframeAPIReady?: () => void }).onYouTubeIframeAPIReady = () => {
			existing?.();
			resolve();
		};

		const existingScript = document.getElementById("youtube-iframe-api");
		if (!existingScript) {
			const script = document.createElement("script");
			script.id = "youtube-iframe-api";
			script.src = "https://www.youtube.com/iframe_api";
			script.onerror = () => {
				ytApiPromise = null;
				reject(new Error("Failed to load YouTube IFrame API"));
			};
			document.head.appendChild(script);
		}
	});

	return ytApiPromise;
}

/**
 * YouTube embed error codes that indicate the video can't be embedded.
 */
export function isEmbedBlocked(errorCode: number): boolean {
	return errorCode === 101 || errorCode === 150;
}
