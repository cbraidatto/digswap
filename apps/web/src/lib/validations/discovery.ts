import { z } from "zod";

export const searchRecordsSchema = z.object({
	term: z.string().min(2, "Search term must be at least 2 characters").max(200).trim(),
});

export const browseRecordsSchema = z.object({
	genre: z.string().max(100).trim().nullable(),
	decade: z.string().max(20).trim().nullable(),
	page: z.number().int().min(1).max(1000).default(1),
});

export type SearchRecordsInput = z.infer<typeof searchRecordsSchema>;
export type BrowseRecordsInput = z.infer<typeof browseRecordsSchema>;
