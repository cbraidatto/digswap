export interface FeedItem {
	id: string;
	userId: string;
	actionType: string;
	targetType: string | null;
	targetId: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	username: string | null;
	displayName: string | null;
	avatarUrl: string | null;
	releaseTitle: string | null;
	releaseArtist: string | null;
	releaseGenre: string[] | null;
	releaseLabel: string | null;
	releaseCoverUrl: string | null;
	releaseRarityScore: number | null;
	releaseYoutubeVideoId: string | null;
	contextReason?: "dna_match" | "network" | "trending" | null;
}
