import { env } from "@/lib/env";

export interface YouTubeSearchResult {
	videoId: string;
	title: string;
	channelTitle: string;
	thumbnail: string;
}

function decodeHtmlEntities(str: string): string {
	return str
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

export async function searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
	const key = env.YOUTUBE_API_KEY;
	if (!key) throw new Error("YOUTUBE_API_KEY not set");

	const params = new URLSearchParams({
		part: "snippet",
		type: "video",
		videoCategoryId: "10", // Music
		maxResults: "10",
		q: query,
		key,
	});

	const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
	if (!res.ok) throw new Error("YouTube API error");

	const data = await res.json();

	return (data.items ?? []).map(
		(item: { id: { videoId: string }; snippet: { title: string; channelTitle: string } }) => ({
			videoId: item.id.videoId,
			title: decodeHtmlEntities(item.snippet.title),
			channelTitle: decodeHtmlEntities(item.snippet.channelTitle),
			// hqdefault = 480x360, always available for any video
			thumbnail: `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
		}),
	);
}
