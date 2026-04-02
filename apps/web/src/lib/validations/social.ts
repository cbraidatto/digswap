import { z } from "zod";
import { uuidSchema } from "./common";

export const logActivitySchema = z.object({
	userId: uuidSchema,
	actionType: z.string().min(1).max(100),
	targetType: z.string().max(100).nullable(),
	targetId: z.string().max(255).nullable(),
	metadata: z.record(z.string(), z.unknown()).nullable(),
});

export const followUserSchema = z.object({
	targetUserId: uuidSchema,
});

export const loadMoreFeedSchema = z.object({
	cursor: z.string().nullable(),
	mode: z.enum(["personal", "global"]),
});

export const userIdSchema = z.object({
	userId: uuidSchema,
});

export const searchUsersSchema = z.object({
	query: z.string().min(2, "Search query must be at least 2 characters").max(200).trim(),
});

export type LogActivityInput = z.infer<typeof logActivitySchema>;
export type FollowUserInput = z.infer<typeof followUserSchema>;
export type LoadMoreFeedInput = z.infer<typeof loadMoreFeedSchema>;
export type SearchUsersInput = z.infer<typeof searchUsersSchema>;
