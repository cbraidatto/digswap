import { z } from "zod";
import { urlSchema } from "./common";

export const updateProfileSchema = z.object({
	displayName: z.string().min(1).max(100).trim().optional(),
	bio: z.string().max(500).trim().optional(),
	location: z.string().max(100).trim().optional(),
	youtubeUrl: urlSchema,
	websiteUrl: urlSchema,
});

export const showcaseSearchSchema = z.object({
	term: z.string().min(1).max(200).trim(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ShowcaseSearchInput = z.infer<typeof showcaseSearchSchema>;
