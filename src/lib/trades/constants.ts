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

export const TRADE_EXPIRY_OPTIONS = [
	{ label: "6h", value: 6 },
	{ label: "12h", value: 12 },
	{ label: "24h", value: 24 },
	{ label: "48h", value: 48 },
] as const;

export const DEFAULT_EXPIRY_HOURS = 48;

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
