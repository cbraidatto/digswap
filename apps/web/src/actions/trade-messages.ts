"use server";

import { and, count, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { tradeMessages, tradeRequests } from "@/lib/db/schema/trades";
import { createClient } from "@/lib/supabase/server";
import { getTradeParticipantContext } from "@/lib/trades/messages";
import { uuidSchema } from "@/lib/validations/common";

const sendTradeMessageSchema = z.object({
	body: z.string().trim().min(1, "Message cannot be empty.").max(2000, "Message is too long."),
	tradeId: uuidSchema,
});

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

export async function sendTradeMessage(tradeId: string, body: string): Promise<void> {
	const user = await requireUser();
	const parsed = sendTradeMessageSchema.safeParse({ body, tradeId });

	if (!parsed.success) {
		throw new Error(parsed.error.issues[0]?.message ?? "Invalid message.");
	}

	const participantContext = await getTradeParticipantContext(parsed.data.tradeId, user.id);
	if (!participantContext) {
		throw new Error("Trade not found or forbidden.");
	}

	const now = new Date();
	const oneMinuteAgo = new Date(now.getTime() - 60_000);
	const rateLimitRows = await db
		.select({ count: count() })
		.from(tradeMessages)
		.where(
			and(
				eq(tradeMessages.tradeId, parsed.data.tradeId),
				eq(tradeMessages.senderId, user.id),
				gte(tradeMessages.createdAt, oneMinuteAgo),
			),
		);

	if (Number(rateLimitRows[0]?.count ?? 0) >= 10) {
		throw new Error("Too many messages in a short period. Please wait a moment.");
	}

	await db.insert(tradeMessages).values({
		body: parsed.data.body,
		kind: "user",
		senderId: user.id,
		tradeId: parsed.data.tradeId,
	});

	await db
		.update(tradeRequests)
		.set(
			participantContext.isRequester
				? {
						requesterLastReadAt: now,
						updatedAt: now,
					}
				: {
						providerLastReadAt: now,
						updatedAt: now,
					},
		)
		.where(eq(tradeRequests.id, parsed.data.tradeId));

	revalidatePath("/trades");
	revalidatePath(`/trades/${parsed.data.tradeId}`);
}

export async function markTradeThreadRead(tradeId: string): Promise<void> {
	const user = await requireUser();
	const parsedTradeId = uuidSchema.safeParse(tradeId);

	if (!parsedTradeId.success) {
		throw new Error("Invalid trade.");
	}

	const participantContext = await getTradeParticipantContext(parsedTradeId.data, user.id);
	if (!participantContext) {
		throw new Error("Trade not found or forbidden.");
	}

	await db
		.update(tradeRequests)
		.set(
			participantContext.isRequester
				? { requesterLastReadAt: new Date() }
				: { providerLastReadAt: new Date() },
		)
		.where(eq(tradeRequests.id, parsedTradeId.data));

	revalidatePath("/trades");
	revalidatePath(`/trades/${parsedTradeId.data}`);
}
