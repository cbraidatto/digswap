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
import { publicEnv } from "@/lib/env";
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
 * Reads NEXT_PUBLIC_MIN_DESKTOP_VERSION from env (parseInt, default 1).
 * The version is a monotonic integer per ADR-002 D-10.
 *
 * No auth required — this is safe to call from the public /desktop/open page.
 */
export async function checkDesktopVersion(): Promise<{ minVersion: number }> {
	try {
		const raw = publicEnv.NEXT_PUBLIC_MIN_DESKTOP_VERSION;
		const minVersion = raw ? parseInt(raw, 10) : 1;
		return { minVersion: Number.isNaN(minVersion) ? 1 : minVersion };
	} catch (err) {
		console.error("[checkDesktopVersion] error:", err);
		return { minVersion: 1 };
	}
}
