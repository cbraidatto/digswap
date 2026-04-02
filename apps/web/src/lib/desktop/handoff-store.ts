/**
 * In-memory store for desktop handoff codes (single-use, short-lived).
 * In production with multiple server instances, replace with Redis.
 */
export const handoffStore = new Map<string, { userId: string; expiresAt: number }>();

// Cleanup expired codes every 60 seconds
if (typeof globalThis !== "undefined") {
	setInterval(() => {
		const now = Date.now();
		for (const [code, entry] of handoffStore) {
			if (entry.expiresAt < now) handoffStore.delete(code);
		}
	}, 60_000).unref?.();
}
