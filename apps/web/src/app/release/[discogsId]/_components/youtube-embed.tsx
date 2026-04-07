"use client";

import { useState } from "react";
import { searchYouTubeForRelease } from "@/actions/release";

interface YouTubeEmbedProps {
	videoId: string | null;
	releaseId: string;
	isAuthenticated: boolean;
}

export function YouTubeEmbed({
	videoId: initialVideoId,
	releaseId,
	isAuthenticated,
}: YouTubeEmbedProps) {
	const [videoId, setVideoId] = useState<string | null>(initialVideoId);
	const [isPending, setIsPending] = useState(false);
	const [searchDone, setSearchDone] = useState(false);

	// If no video and not authenticated, render nothing
	if (!videoId && !isAuthenticated) {
		return null;
	}

	async function handleSearch() {
		setIsPending(true);
		try {
			const result = await searchYouTubeForRelease(releaseId);
			if (result.videoId) {
				setVideoId(result.videoId);
			}
			setSearchDone(true);
		} catch {
			setSearchDone(true);
		} finally {
			setIsPending(false);
		}
	}

	// Render iframe if videoId is available
	if (videoId) {
		return (
			<section className="space-y-2">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">YOUTUBE_PREVIEW</span>
				<div className="aspect-video w-full rounded-lg overflow-hidden">
					<iframe
						src={`https://www.youtube-nocookie.com/embed/${videoId}`}
						width="100%"
						height="100%"
						className="rounded-lg"
						allowFullScreen
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
						title="YouTube video player"
					/>
				</div>
			</section>
		);
	}

	// Authenticated user, no video yet — offer search
	if (isAuthenticated) {
		return (
			<section className="space-y-2">
				<span className="font-mono text-xs text-primary tracking-[0.2em]">YOUTUBE_PREVIEW</span>
				{searchDone ? (
					<p className="font-mono text-xs text-on-surface-variant">
						No video found for this release.
					</p>
				) : (
					<button
						type="button"
						onClick={handleSearch}
						disabled={isPending}
						className="font-mono text-xs bg-surface-container-low border border-outline-variant/20 rounded px-3 py-2 hover:border-primary/30 transition-colors disabled:opacity-50"
					>
						{isPending ? "SEARCHING..." : "SEARCH_YOUTUBE"}
					</button>
				)}
			</section>
		);
	}

	return null;
}
