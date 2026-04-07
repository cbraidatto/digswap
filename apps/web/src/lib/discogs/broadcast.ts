import type { DiscogsProgressPayload } from "./types";
import { getImportChannelName } from "./types";

/**
 * Broadcasts import progress to a user's Realtime channel via the Supabase
 * Broadcast REST API (server-side, no WebSocket needed).
 *
 * Non-fatal: if broadcast fails, the import continues -- progress display
 * is a nice-to-have, not a blocker.
 */
export async function broadcastProgress(
	userId: string,
	payload: DiscogsProgressPayload,
): Promise<void> {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
	const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
	const channel = getImportChannelName(userId);

	try {
		const response = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
			method: "POST",
			headers: {
				apikey: serviceKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: [
					{
						topic: channel,
						event: "progress",
						payload,
					},
				],
			}),
		});

		if (!response.ok) {
			console.error(`Broadcast failed: ${response.status} ${response.statusText}`);
		}
	} catch (error) {
		// Non-fatal: progress display is a nice-to-have, import continues
		console.error("Broadcast error:", error);
	}
}
