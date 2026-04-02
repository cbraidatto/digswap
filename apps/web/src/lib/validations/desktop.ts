import { z } from "zod";
import { uuidSchema } from "./common";

export const handoffTokenSchema = z.object({
	tradeId: uuidSchema,
});

export type HandoffTokenInput = z.infer<typeof handoffTokenSchema>;
