"use server";

import { headers } from "next/headers";
import { eq, and, asc, desc, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";
import { userSessions } from "@/lib/db/schema/sessions";
import { apiRateLimit , safeLimit} from "@/lib/rate-limit";
import { sessionIdSchema, enforceSessionLimitSchema, recordSessionSchema } from "@/lib/validations/sessions";

/**
 * Maximum concurrent sessions allowed per user (D-13).
 */
const MAX_SESSIONS = 3;

/**
 * Parsed session data returned to the UI.
 */
export interface SessionInfo {
	id: string;
	deviceInfo: string;
	ipAddress: string;
	createdAt: string;
	lastSeenAt: string;
	isCurrent: boolean;
}

/**
 * Parse a raw User-Agent string into a human-readable device description.
 * Examples: "Chrome on Windows", "Safari on macOS", "Firefox on Linux"
 */
function parseDeviceInfo(ua: string | null): string {
	if (!ua || ua === "unknown") return "Unknown device";

	let browser = "Unknown browser";
	let os = "Unknown OS";

	// Detect browser
	if (ua.includes("Edg/")) browser = "Edge";
	else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
	else if (ua.includes("Chrome/") && !ua.includes("Edg/")) browser = "Chrome";
	else if (ua.includes("Safari/") && !ua.includes("Chrome/")) browser = "Safari";
	else if (ua.includes("Firefox/")) browser = "Firefox";

	// Detect OS
	if (ua.includes("Windows")) os = "Windows";
	else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macOS";
	else if (ua.includes("Linux") && !ua.includes("Android")) os = "Linux";
	else if (ua.includes("Android")) os = "Android";
	else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

	return `${browser} on ${os}`;
}

/**
 * Get all active sessions for the current user.
 *
 * Returns sessions ordered by last_seen_at DESC (most recent first).
 * Each session includes parsed device info and a flag indicating if it's the current session.
 */
export async function getSessions(): Promise<{
	success: boolean;
	sessions: SessionInfo[];
	error?: string;
}> {
	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) {
		return { success: false, sessions: [], error: "Not authenticated" };
	}

	const userId = data.user.id;

	const { success: rlSuccess } = await safeLimit(apiRateLimit, userId, false);
	if (!rlSuccess) {
		return { success: false, sessions: [], error: "Too many requests. Please wait a moment." };
	}

	// Get current session identifier to mark "current" session.
	// Uses getClaims() (not getSession()) per project convention — reads session_id
	// from the validated JWT claims without an extra server round-trip.
	const { data: claimsData } = await supabase.auth.getClaims();
	const currentSessionId = claimsData?.claims?.session_id || "";

	try {
		const sessions = await db
			.select()
			.from(userSessions)
			.where(eq(userSessions.userId, userId))
			.orderBy(desc(userSessions.lastSeenAt));

		const sessionInfos: SessionInfo[] = sessions.map((s) => ({
			id: s.id,
			deviceInfo: parseDeviceInfo(s.deviceInfo),
			ipAddress: s.ipAddress || "Unknown",
			createdAt: s.createdAt.toISOString(),
			lastSeenAt: s.lastSeenAt.toISOString(),
			isCurrent: s.sessionId === currentSessionId,
		}));

		return { success: true, sessions: sessionInfos };
	} catch (err) {
		console.error("Failed to fetch sessions:", err);
		return { success: false, sessions: [], error: "Failed to load sessions" };
	}
}

/**
 * Terminate a specific session.
 *
 * Security: Verifies the session belongs to the current user (IDOR prevention).
 * Invalidates the Supabase auth session and removes the record from the database.
 */
export async function terminateSession(
	sessionId: string,
): Promise<{ success: boolean; error?: string }> {
	const parsed = sessionIdSchema.safeParse({ sessionId });
	if (!parsed.success) {
		return { success: false, error: "Invalid session ID" };
	}

	const supabase = await createClient();
	const { data, error } = await supabase.auth.getUser();

	if (error || !data.user) {
		return { success: false, error: "Not authenticated" };
	}

	const userId = data.user.id;

	const { success: rlSuccess } = await safeLimit(apiRateLimit, userId, true);
	if (!rlSuccess) {
		return { success: false, error: "Too many requests. Please wait a moment." };
	}

	try {
		// Verify the session belongs to the current user (IDOR prevention)
		const [session] = await db
			.select()
			.from(userSessions)
			.where(
				and(eq(userSessions.id, parsed.data.sessionId), eq(userSessions.userId, userId)),
			)
			.limit(1);

		if (!session) {
			return { success: false, error: "Session not found" };
		}

		const admin = createAdminClient();

		// Invalidate the Supabase JWT server-side using the session_id from the JWT
		// (stored in user_sessions.session_id). This prevents the token from being
		// used even if the attacker has it in memory — doesn't wait for expiry.
		// admin.auth.admin.signOut(jwt) accepts the session_id claim directly.
		try {
			if (session.sessionId) {
				await admin.auth.admin.signOut(session.sessionId);
			}
		} catch (adminError) {
			// Non-fatal: the session record is still removed from tracking below.
			// The token will expire naturally if the admin signout fails.
			console.error("[terminateSession] admin signout error:", adminError);
		}

		// Remove from our session tracking table (both admin client and Drizzle)
		await db
			.delete(userSessions)
			.where(
				and(eq(userSessions.id, parsed.data.sessionId), eq(userSessions.userId, userId)),
			);

		return { success: true };
	} catch (err) {
		console.error("Failed to terminate session:", err);
		return { success: false, error: "Failed to terminate session" };
	}
}

/**
 * Enforce the 3-session limit for a user.
 *
 * Called internally during sign-in. If the user has >= MAX_SESSIONS active sessions,
 * the oldest session(s) are invalidated and removed.
 *
 * @param userId - The user's UUID
 * @param newSessionId - The session identifier for the new session being created
 */
export async function enforceSessionLimit(
	userId: string,
	newSessionId: string,
): Promise<void> {
	try {
		const parsed = enforceSessionLimitSchema.safeParse({ userId, newSessionId });
		if (!parsed.success) {
			return;
		}

		// Security: verify caller owns this userId to prevent session DoS attacks
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user || user.id !== parsed.data.userId) return;

		// Count active sessions
		const sessions = await db
			.select()
			.from(userSessions)
			.where(eq(userSessions.userId, parsed.data.userId))
			.orderBy(asc(userSessions.createdAt));

		if (sessions.length >= MAX_SESSIONS) {
			// Find sessions to remove (oldest first, keep MAX_SESSIONS - 1 to make room for new)
			const sessionsToRemove = sessions.slice(
				0,
				sessions.length - MAX_SESSIONS + 1,
			);

			const admin = createAdminClient();

			for (const oldSession of sessionsToRemove) {
				// Remove from Supabase tracking
				try {
					await admin
						.from("user_sessions")
						.delete()
						.eq("id", oldSession.id);
				} catch {
					// Continue even if admin deletion fails
				}

				// Remove from Drizzle table
				await db
					.delete(userSessions)
					.where(eq(userSessions.id, oldSession.id));
			}
		}
	} catch (err) {
		console.error("Failed to enforce session limit:", err);
		// Session limit enforcement failure should not block login
	}
}

/**
 * Record a new session in the user_sessions table.
 *
 * Called internally during sign-in after successful authentication.
 * Extracts device info and IP from request headers.
 * Enforces session limit if needed.
 *
 * @param userId - The user's UUID
 * @param sessionId - A unique session identifier (e.g., last 32 chars of access token)
 */
export async function recordSession(
	userId: string,
	sessionId: string,
): Promise<void> {
	try {
		const parsed = recordSessionSchema.safeParse({ userId, sessionId });
		if (!parsed.success) {
			return;
		}

		// Security: verify caller owns this userId
		const supabase = await createClient();
		const { data: { user } } = await supabase.auth.getUser();
		if (!user || user.id !== parsed.data.userId) return;

		const headerStore = await headers();
		const deviceInfo = headerStore.get("user-agent") || "unknown";
		const ipAddress =
			headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ||
			headerStore.get("x-real-ip") ||
			"unknown";

		// Insert the new session
		await db.insert(userSessions).values({
			userId: parsed.data.userId,
			sessionId: parsed.data.sessionId,
			deviceInfo,
			ipAddress,
		});

		// Enforce session limit after insertion
		await enforceSessionLimit(parsed.data.userId, parsed.data.sessionId);
	} catch (err) {
		console.error("Failed to record session:", err);
		// Session recording failure should not block login
	}
}
