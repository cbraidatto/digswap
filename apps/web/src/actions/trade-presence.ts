"use server";

import { requireUser } from "@/lib/auth/require-user";
import { deriveTradePresence, type TradePresenceSnapshot } from "@/lib/trades/presence";
import { uuidSchema } from "@/lib/validations/common";

export async function getTradePresence(
	tradeId: string,
): Promise<TradePresenceSnapshot | { error: string }> {
	try {
		const user = await requireUser();
		const parsedTradeId = uuidSchema.safeParse(tradeId);

		if (!parsedTradeId.success) {
			return { error: "Invalid trade." };
		}

		return deriveTradePresence(parsedTradeId.data, user.id);
	} catch (err) {
		console.error("[getTradePresence] error:", err);
		return { error: "Failed to get trade presence." };
	}
}
