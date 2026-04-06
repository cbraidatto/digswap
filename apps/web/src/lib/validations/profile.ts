import { z } from "zod";
import { urlSchema } from "./common";

// Social links must be HTTPS to prevent XSS via javascript: protocol
const socialUrlSchema = z
	.string()
	.url("Invalid URL")
	.max(500)
	.refine(
		(v) => {
			try { return new URL(v).protocol === "https:"; } catch { return false; }
		},
		"Social links must use https://",
	)
	.optional()
	.or(z.literal(""));

export const updateProfileSchema = z.object({
	displayName: z.string().min(1).max(100).trim().optional(),
	bio: z.string().max(500).trim().optional(),
	location: z.string().max(100).trim().optional(),
	youtubeUrl: socialUrlSchema,
	websiteUrl: socialUrlSchema,
});

export const showcaseSearchSchema = z.object({
	term: z.string().min(1).max(200).trim(),
});

export const showcaseSlotSchema = z.object({
	slot: z.enum(["searching", "rarest", "favorite"]),
	releaseId: z.string().uuid("Invalid release ID").nullable(),
});

export const holyGrailsSchema = z.object({
	ids: z.array(z.string().uuid("Invalid release ID")).max(3, "Maximum 3 Holy Grails allowed"),
});

export const coverPositionSchema = z.object({
	positionY: z.number().min(0).max(100),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ShowcaseSearchInput = z.infer<typeof showcaseSearchSchema>;
