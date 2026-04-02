import { z } from "zod";
import { uuidSchema } from "./common";

export const releaseIdSchema = z.object({
	releaseInternalId: uuidSchema,
});

export const getMoreReviewsSchema = z.object({
	releaseId: uuidSchema,
	cursor: z.string().min(1, "Cursor is required"),
	limit: z.number().int().min(1).max(50).default(10),
});

export type ReleaseIdInput = z.infer<typeof releaseIdSchema>;
export type GetMoreReviewsInput = z.infer<typeof getMoreReviewsSchema>;
