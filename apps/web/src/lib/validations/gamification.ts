import { z } from "zod";

export const leaderboardPageSchema = z.object({
	page: z.number().int().min(1).max(1000).optional(),
});

export const genreLeaderboardSchema = z.object({
	genre: z.string().min(1, "Genre is required").max(100).trim(),
	page: z.number().int().min(1).max(1000).optional(),
});

export type LeaderboardPageInput = z.infer<typeof leaderboardPageSchema>;
export type GenreLeaderboardInput = z.infer<typeof genreLeaderboardSchema>;
