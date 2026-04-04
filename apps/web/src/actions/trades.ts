"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { tradeRequests } from "@/lib/db/schema/trades";
import { tradeRateLimit, safeLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { checkAndIncrementTradeCount } from "@/lib/entitlements";
import { uuidSchema } from "@/lib/validations/common";

const createTradeSchema = z.object({
	providerId: uuidSchema,
	releaseId: uuidSchema.optional(),
	offeringReleaseId: uuidSchema.optional(),
	message: z.string().max(1000).trim().optional(),
});

export async function initiateTradeAction(input: {
	providerId: string;
	releaseId?: string;
	offeringReleaseId?: string;
	message?: string;
}): Promise<{ tradeId: string } | { error: string; limitReached?: boolean }> {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) return { error: "Not authenticated" };

		// Rate limit: trade initiation is expensive — use stricter trade limiter
		const { success: rlSuccess } = await safeLimit(tradeRateLimit, user.id, true);
		if (!rlSuccess) {
			return { error: "Too many requests. Please wait a moment." };
		}

		const parsed = createTradeSchema.safeParse(input);
		if (!parsed.success) {
			return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
		}

		if (parsed.data.providerId === user.id) {
			return { error: "Cannot initiate a trade with yourself." };
		}

		// Enforce quota before INSERT — atomic increment prevents TOCTOU race
		const entitlement = await checkAndIncrementTradeCount(user.id);
		if (!entitlement.allowed) {
			return {
				error: `Monthly trade limit reached (${entitlement.tradesLimit}/month). Upgrade to Premium for unlimited trades.`,
				limitReached: true,
			};
		}

		const [row] = await db
			.insert(tradeRequests)
			.values({
				requesterId: user.id,
				providerId: parsed.data.providerId,
				releaseId: parsed.data.releaseId ?? null,
				offeringReleaseId: parsed.data.offeringReleaseId ?? null,
				message: parsed.data.message ?? null,
				status: "pending",
			})
			.returning({ id: tradeRequests.id });

		if (!row) {
			return { error: "Failed to create trade request." };
		}

		return { tradeId: row.id };
	} catch (err) {
		console.error("[initiateTradeAction] error:", err);
		return { error: "Failed to initiate trade. Please try again." };
	}
}
