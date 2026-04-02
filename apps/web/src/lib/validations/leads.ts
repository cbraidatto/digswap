import { z } from "zod";
import { uuidSchema } from "./common";

const leadTargetTypeSchema = z.enum(["release", "user", "radar_match"]);
const leadStatusSchema = z.enum(["watching", "contacted", "dead_end", "found"]);

export const saveLeadSchema = z.object({
	targetType: leadTargetTypeSchema,
	targetId: z.string().min(1, "Target ID is required").max(255),
	note: z.string().max(1000).nullable(),
	status: leadStatusSchema,
});

export const getLeadSchema = z.object({
	targetType: leadTargetTypeSchema,
	targetId: z.string().min(1, "Target ID is required").max(255),
});

export const getLeadsFilterSchema = z.object({
	status: leadStatusSchema.optional(),
	targetType: leadTargetTypeSchema.optional(),
}).optional();

export type SaveLeadInput = z.infer<typeof saveLeadSchema>;
export type GetLeadInput = z.infer<typeof getLeadSchema>;
