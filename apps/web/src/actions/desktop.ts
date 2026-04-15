"use server";

/**
 * Server actions for the web→desktop handoff flow.
 *
 * generateHandoffToken: creates a short-TTL signed token for a specific trade,
 * after verifying the caller is a participant (IDOR protection).
 *
 * checkDesktopVersion: returns the minimum desktop version required to proceed
 * with a trade, as set by NEXT_PUBLIC_MIN_DESKTOP_VERSION.
 *
 * See: ADR-002-desktop-trade-runtime.md D-08, D-10
 */

import { and, eq, or } from "drizzle-orm";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { tradeRequests } from "@/lib/db/schema/trades";
import { createHandoffToken } from "@/lib/desktop/handoff-token";
import { MIN_DESKTOP_VERSION, TRADE_PROTOCOL_VERSION } from "@/lib/desktop/version";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validations/common";
import { handoffTokenSchema } from "@/lib/validations/desktop";

/**
 * Generate a handoff token for the given trade.
 *
 * Security:
 * - Requires authenticated session (getUser)
 * - Verifies caller is requesterId OR providerId (IDOR protection)
 * - Token is HMAC-signed and single-use (see createHandoffToken)
 *
 * @param tradeId - UUID of the trade to open in the desktop app
 * @returns { token: string } on success, { error: string } on failure
 */
export async function generateHandoffToken(
	tradeId: string,
): Promise<{ token: string } | { error: string }> {
	try {
		const parsed = handoffTokenSchema.safeParse({ tradeId });
		if (!parsed.success) {
			return { error: "Invalid trade ID" };
		}

		const user = await requireUser();
		const userId = user.id;

		// Verify caller is a participant in the trade (IDOR protection)
		const trades = await db
			.select({ id: tradeRequests.id })
			.from(tradeRequests)
			.where(
				and(
					eq(tradeRequests.id, parsed.data.tradeId),
					or(eq(tradeRequests.requesterId, userId), eq(tradeRequests.providerId, userId)),
				),
			);

		if (trades.length === 0) {
			return { error: "Trade not found or you are not a participant" };
		}

		const token = await createHandoffToken(parsed.data.tradeId, userId);
		return { token };
	} catch (err) {
		console.error("[generateHandoffToken] failed:", err);
		return { error: "Failed to generate handoff token" };
	}
}

/**
 * Return the minimum desktop app version required for trading.
 *
 * Reads NEXT_PUBLIC_MIN_DESKTOP_VERSION from env (semver string, default 0.2.0).
 *
 * No auth required — this is safe to call from the public /desktop/open page.
 */
export async function checkDesktopVersion(): Promise<{
	minVersion: string;
	tradeProtocolVersion: number;
}> {
	try {
		const raw = publicEnv.NEXT_PUBLIC_MIN_DESKTOP_VERSION;
		return {
			minVersion: raw?.trim() || MIN_DESKTOP_VERSION,
			tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
		};
	} catch (err) {
		console.error("[checkDesktopVersion] error:", err);
		return {
			minVersion: MIN_DESKTOP_VERSION,
			tradeProtocolVersion: TRADE_PROTOCOL_VERSION,
		};
	}
}

const validatePreviewSchema = handoffTokenSchema.extend({
	proposalItemId: uuidSchema,
});

export async function validatePreviewAction(
	tradeId: string,
	proposalItemId: string,
): Promise<{ errors: string[]; valid: boolean }> {
	try {
		await requireUser();

		const parsed = validatePreviewSchema.safeParse({ proposalItemId, tradeId });
		if (!parsed.success) {
			return { valid: false, errors: ["Invalid trade or proposal item ID."] };
		}

		const supabase = await createClient();
		const { data, error } = await supabase.functions.invoke("validate-preview", {
			body: {
				proposalItemId: parsed.data.proposalItemId,
				tradeId: parsed.data.tradeId,
			},
		});

		if (error) {
			console.error("[validatePreviewAction] failed:", error);
			return { valid: false, errors: ["Failed to validate the uploaded preview."] };
		}

		if (
			typeof data === "object" &&
			data !== null &&
			Array.isArray((data as { errors?: unknown }).errors) &&
			typeof (data as { valid?: unknown }).valid === "boolean"
		) {
			return data as { errors: string[]; valid: boolean };
		}

		return { valid: false, errors: ["Preview validation returned an invalid response."] };
	} catch (err) {
		console.error("[validatePreviewAction] error:", err);
		return { valid: false, errors: ["Failed to validate the uploaded preview."] };
	}
}
