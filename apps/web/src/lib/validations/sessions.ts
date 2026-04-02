import { z } from "zod";
import { uuidSchema } from "./common";

export const sessionIdSchema = z.object({
	sessionId: z.string().min(1, "Session ID is required").max(255),
});

export const enforceSessionLimitSchema = z.object({
	userId: uuidSchema,
	newSessionId: z.string().min(1).max(255),
});

export const recordSessionSchema = z.object({
	userId: uuidSchema,
	sessionId: z.string().min(1).max(255),
});

export type SessionIdInput = z.infer<typeof sessionIdSchema>;
export type EnforceSessionLimitInput = z.infer<typeof enforceSessionLimitSchema>;
export type RecordSessionInput = z.infer<typeof recordSessionSchema>;
