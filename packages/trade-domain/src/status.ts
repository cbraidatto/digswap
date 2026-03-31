export const TRADE_STATUS = {
	PENDING: "pending",
	LOBBY: "lobby",
	PREVIEWING: "previewing",
	ACCEPTED: "accepted",
	TRANSFERRING: "transferring",
	COMPLETED: "completed",
	DECLINED: "declined",
	CANCELLED: "cancelled",
	EXPIRED: "expired",
} as const;

export type TradeStatus = (typeof TRADE_STATUS)[keyof typeof TRADE_STATUS];

export const TRADE_STATUS_TRANSITIONS: Record<TradeStatus, TradeStatus[]> = {
	pending: ["lobby", "declined", "cancelled", "expired"],
	lobby: ["previewing", "declined", "cancelled", "expired"],
	previewing: ["accepted", "declined", "cancelled", "expired"],
	accepted: ["transferring", "cancelled", "expired"],
	transferring: ["completed", "cancelled"],
	completed: [],
	declined: [],
	cancelled: [],
	expired: [],
};
