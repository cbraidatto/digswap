export const TRADE_PROTOCOL_VERSION = 1 as const;

export const TRANSFER_CHUNK_SIZE_BYTES = 64 * 1024;
export const TRANSFER_ACK_INTERVAL = 16;

export const TRADE_LEASE_HEARTBEAT_INTERVAL_MS = 15_000;
export const TRADE_LEASE_STALE_AFTER_MS = 45_000;
export const TRADE_HANDOFF_TOKEN_TTL_MS = 30_000;

export const RECEIVED_FILE_STORE_ROOT_SEGMENTS = [
	"Music",
	"DigSwap",
	"Incoming",
] as const;
