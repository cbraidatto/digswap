import { z } from "zod";
import { uuidSchema } from "./common";

export const feedItemIdSchema = z.object({
	feedItemId: uuidSchema,
});

export const feedItemIdsSchema = z.object({
	feedItemIds: z.array(uuidSchema).min(1).max(100),
});

export const diggerDnaSchema = z.object({
	userId: uuidSchema.optional(),
});

export const getDiggerDnaSchema = z.object({
	userId: uuidSchema,
});

export const logListeningSchema = z.object({
	releaseId: uuidSchema,
	caption: z.string().max(500).trim().optional(),
	rating: z.number().int().min(1).max(5).optional(),
});

export type FeedItemIdInput = z.infer<typeof feedItemIdSchema>;
export type FeedItemIdsInput = z.infer<typeof feedItemIdsSchema>;
export type LogListeningInput = z.infer<typeof logListeningSchema>;
