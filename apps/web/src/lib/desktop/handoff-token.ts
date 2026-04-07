/**
 * Handoff token infrastructure for web→desktop protocol handoff.
 *
 * Creates short-TTL HMAC-SHA256 signed tokens that are stored in the DB
 * and consumed exactly once when the desktop app exchanges them for a session.
 *
 * See: ADR-002-desktop-trade-runtime.md D-08
 * See: src/actions/desktop.ts (server action wrapper)
 */

import { createHmac, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { handoffTokens } from "@/lib/db/schema/trades";

/**
 * Token TTL: 30 seconds — aligned with TRADE_HANDOFF_TOKEN_TTL_MS in trade-domain
 * and HANDOFF_TTL_SECONDS in handoff-store.ts.
 * SECURITY: Shorter TTL reduces the window for token interception/replay.
 */
const TOKEN_TTL_MS = 30_000;

function getHmacSecret(): string {
	const secret = process.env.HANDOFF_HMAC_SECRET;
	if (!secret) {
		throw new Error("HANDOFF_HMAC_SECRET env var is required for handoff token operations");
	}
	return secret;
}

function computeHmac(plaintext: string, secret: string): string {
	return createHmac("sha256", secret).update(plaintext).digest("hex");
}

/**
 * Generate a 32-byte random handoff token, store its HMAC-SHA256 hash in the DB,
 * and return the plaintext token to be included in the digswap:// URL.
 *
 * The plaintext is never persisted — only the HMAC is stored.
 *
 * @param tradeId - UUID of the trade this token grants access to
 * @param userId - UUID of the user requesting the handoff
 * @returns Plaintext 64-char hex token (32 random bytes)
 */
export async function createHandoffToken(tradeId: string, userId: string): Promise<string> {
	const plaintext = randomBytes(32).toString("hex");
	const hmac = computeHmac(plaintext, getHmacSecret());
	const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

	await db
		.insert(handoffTokens)
		.values({
			tradeId,
			userId,
			tokenHmac: hmac,
			expiresAt,
		})
		.returning({ id: handoffTokens.id });

	return plaintext;
}

/**
 * Verify and atomically consume a handoff token.
 *
 * Recomputes the HMAC from the provided plaintext, fetches the matching row
 * (tokenHmac + tradeId + userId, usedAt IS NULL), checks expiry, then
 * marks usedAt = now() in a compare-and-swap fashion (WHERE usedAt IS NULL).
 *
 * Returns true only if:
 * 1. A matching row exists with usedAt IS NULL
 * 2. The row has not expired (expiresAt > now)
 * 3. The UPDATE succeeded (i.e. we won the race — no concurrent replay)
 *
 * Returns false for: wrong plaintext, wrong tradeId/userId, expired token, replay.
 *
 * @param plaintext - The 64-char hex token from the digswap:// URL
 * @param tradeId - Trade UUID from the URL (must match stored row)
 * @param userId - Authenticated user's UUID (must match stored row)
 */
export async function verifyAndConsumeHandoffToken(
	plaintext: string,
	tradeId: string,
	userId: string,
): Promise<boolean> {
	const hmac = computeHmac(plaintext, getHmacSecret());

	// Fetch the matching unused row
	const rows = await db
		.select()
		.from(handoffTokens)
		.where(
			and(
				eq(handoffTokens.tokenHmac, hmac),
				eq(handoffTokens.tradeId, tradeId),
				eq(handoffTokens.userId, userId),
				isNull(handoffTokens.usedAt),
			),
		);

	if (rows.length === 0) {
		// No matching unused token — either wrong token, wrong trade, or already consumed
		return false;
	}

	const row = rows[0];

	// Check expiry in application layer (DB row might be found but expired)
	if (row.expiresAt < new Date()) {
		return false;
	}

	// Atomically claim the token — WHERE usedAt IS NULL prevents concurrent replay
	const updated = await db
		.update(handoffTokens)
		.set({ usedAt: new Date() })
		.where(and(eq(handoffTokens.id, row.id), isNull(handoffTokens.usedAt)))
		.returning({ id: handoffTokens.id });

	if (updated.length === 0) {
		// Concurrent request already consumed this token — replay blocked
		return false;
	}

	return true;
}
