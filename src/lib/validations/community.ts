import { z } from "zod";
import { uuidSchema } from "./common";

export const createPostSchema = z.object({
	groupId: uuidSchema,
	content: z.string().min(1, "Post content is required").max(5000).trim(),
	releaseId: uuidSchema.optional(),
});

export const createReviewSchema = z.object({
	releaseId: uuidSchema,
	rating: z.number().int().min(1).max(5),
	title: z.string().min(1).max(200).trim().optional(),
	body: z.string().min(1, "Review body is required").max(5000).trim(),
	groupId: uuidSchema.optional(),
});

export const createGroupSchema = z.object({
	name: z.string().min(3, "Group name must be at least 3 characters").max(100).trim(),
	description: z.string().max(500).trim().optional(),
	visibility: z.enum(["public", "private"]).default("public"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
