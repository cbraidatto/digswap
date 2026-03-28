import { z } from "zod";
import { uuidSchema } from "./common";

export const createTradeRequestSchema = z.object({
	recipientId: uuidSchema,
	releaseId: uuidSchema,
	message: z.string().max(500).trim().optional(),
});

export const tradeReviewSchema = z.object({
	tradeId: uuidSchema,
	rating: z.number().int().min(1).max(5),
	comment: z.string().max(1000).trim().optional(),
});

export type CreateTradeRequestInput = z.infer<typeof createTradeRequestSchema>;
export type TradeReviewInput = z.infer<typeof tradeReviewSchema>;
