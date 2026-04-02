import { z } from "zod";
import { uuidSchema } from "./common";

export const notificationPageSchema = z.object({
	page: z.number().int().min(1).max(1000).default(1),
});

export const recentNotificationsSchema = z.object({
	limit: z.number().int().min(1).max(50).default(5),
});

export const notificationIdSchema = z.object({
	notificationId: uuidSchema,
});

export const updatePreferencesSchema = z.object({
	wantlistMatchInapp: z.boolean().optional(),
	wantlistMatchEmail: z.boolean().optional(),
	tradeRequestInapp: z.boolean().optional(),
	tradeRequestEmail: z.boolean().optional(),
	tradeCompletedInapp: z.boolean().optional(),
	rankingChangeInapp: z.boolean().optional(),
	newBadgeInapp: z.boolean().optional(),
	pushEnabled: z.boolean().optional(),
});

export type NotificationPageInput = z.infer<typeof notificationPageSchema>;
export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
