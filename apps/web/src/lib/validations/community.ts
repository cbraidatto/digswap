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
	pressingDetails: z.string().max(2000).trim().optional(),
	groupId: uuidSchema.optional(),
});

export const createGroupSchema = z.object({
	name: z.string().min(1, "Group name is required.").max(80, "Group name must be 80 characters or fewer.").trim(),
	description: z.string().max(500).trim().optional(),
	category: z.string().max(100).trim().optional(),
	visibility: z.enum(["public", "private"]).default("public"),
});

export const groupIdSchema = z.object({
	groupId: uuidSchema,
});

export const inviteUserSchema = z.object({
	groupId: uuidSchema,
	username: z.string().min(1, "Username is required").max(100).trim(),
});

export const inviteTokenSchema = z.object({
	token: z.string().uuid("Invalid invite token"),
});

export const groupMemberSchema = z.object({
	groupId: uuidSchema,
	targetUserId: uuidSchema,
});

export const loadGroupPostsSchema = z.object({
	groupId: uuidSchema,
	cursor: z.string().uuid().optional(),
});

export const genreFilterSchema = z.object({
	genreFilter: z.string().max(100).trim().optional(),
});

export const genreFilterCursorSchema = z.object({
	genreFilter: z.string().max(100).trim().optional(),
	cursor: z.string().uuid().optional(),
});

export const releaseIdCursorSchema = z.object({
	releaseId: uuidSchema,
	cursor: z.string().uuid().optional(),
});

export const releaseIdSchema = z.object({
	releaseId: uuidSchema,
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
