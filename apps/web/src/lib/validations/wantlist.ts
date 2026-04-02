import { z } from "zod";
import { uuidSchema } from "./common";

export const addToWantlistSchema = z.object({
	discogsId: z.number().int().positive("Invalid Discogs ID"),
});

export const wantlistItemIdSchema = z.object({
	wantlistItemId: uuidSchema,
});

export const addFromYouTubeSchema = z.object({
	videoId: z.string().min(1, "Video ID is required").max(50),
	title: z.string().min(1, "Title is required").max(500),
	channelTitle: z.string().min(1, "Channel title is required").max(500),
	thumbnail: z.string().url("Invalid thumbnail URL").max(1000),
});

export type AddToWantlistInput = z.infer<typeof addToWantlistSchema>;
export type WantlistItemIdInput = z.infer<typeof wantlistItemIdSchema>;
export type AddFromYouTubeInput = z.infer<typeof addFromYouTubeSchema>;
