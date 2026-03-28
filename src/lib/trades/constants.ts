export const CHUNK_SIZE = 64 * 1024; // 64KB per D-10

export const TRADE_STATUS = {
	PENDING: "pending",
	ACCEPTED: "accepted",
	TRANSFERRING: "transferring",
	COMPLETED: "completed",
	DECLINED: "declined",
	CANCELLED: "cancelled",
	EXPIRED: "expired",
} as const;

export type TradeStatus = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];

export const TRADE_EXPIRY_HOURS = 24;

export const MAX_FREE_TRADES_PER_MONTH = 5;

export const ACCEPTED_AUDIO_TYPES = [
	"audio/flac",
	"audio/wav",
	"audio/mp3",
	"audio/mpeg",
	"audio/ogg",
	"audio/aac",
] as const;

export function isP2PEnabled(): boolean {
	return process.env.P2P_ENABLED === "true";
}

/** Client-safe P2P check. Requires NEXT_PUBLIC_P2P_ENABLED env var. */
export function isP2PEnabledClient(): boolean {
	return process.env.NEXT_PUBLIC_P2P_ENABLED === "true";
}
