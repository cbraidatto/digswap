import { z } from "zod";
import { uuidSchema } from "./common";

export const generateWrappedSchema = z.object({
	userId: uuidSchema,
	year: z
		.number()
		.int()
		.min(2000, "Year must be 2000 or later")
		.max(2100, "Year too far in the future")
		.optional(),
});

export type GenerateWrappedInput = z.infer<typeof generateWrappedSchema>;
