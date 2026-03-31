"use server";

import { createClient } from "@/lib/supabase/server";
import { deriveTradePresence, type TradePresenceSnapshot } from "@/lib/trades/presence";
import { uuidSchema } from "@/lib/validations/common";

async function requireUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		throw new Error("Not authenticated");
	}

	return user;
}

export async function getTradePresence(tradeId: string): Promise<TradePresenceSnapshot> {
	const user = await requireUser();
	const parsedTradeId = uuidSchema.safeParse(tradeId);

	if (!parsedTradeId.success) {
		throw new Error("Invalid trade.");
	}

	return deriveTradePresence(parsedTradeId.data, user.id);
}
