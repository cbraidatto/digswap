import { z } from "zod";

export const searchDiscogsSchema = z.object({
	query: z.string().max(200).trim(),
});

export const addRecordSchema = z.object({
	discogsId: z.number().int().positive("Invalid Discogs ID"),
});

export const updateConditionSchema = z.object({
	collectionItemId: z.string().uuid("Invalid collection item ID"),
});

export type SearchDiscogsInput = z.infer<typeof searchDiscogsSchema>;
export type AddRecordInput = z.infer<typeof addRecordSchema>;
