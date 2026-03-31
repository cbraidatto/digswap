import { createClient } from "@/lib/supabase/server";
import { getTradeParticipantContext } from "@/lib/trades/messages";

export type TradePresenceState = "both_online" | "me_only" | "counterparty_only" | "neither";

export interface TradePresenceParticipant {
	isOnline: boolean;
	lastSeenAt: string | null;
	userId: string;
}

export interface TradePresenceSnapshot {
	counterparty: TradePresenceParticipant;
	me: TradePresenceParticipant;
	state: TradePresenceState;
	tradeId: string;
}

interface TradePresenceRow {
	is_active: boolean | null;
	last_heartbeat_at: string | null;
	user_id: string;
}

function normalizeTimestamp(value: string | null) {
	return value ? new Date(value).toISOString() : null;
}

function deriveState(meOnline: boolean, counterpartyOnline: boolean): TradePresenceState {
	if (meOnline && counterpartyOnline) {
		return "both_online";
	}

	if (meOnline) {
		return "me_only";
	}

	if (counterpartyOnline) {
		return "counterparty_only";
	}

	return "neither";
}

export async function deriveTradePresence(
	tradeId: string,
	userId: string,
): Promise<TradePresenceSnapshot> {
	const participantContext = await getTradeParticipantContext(tradeId, userId);
	if (!participantContext) {
		throw new Error("Trade not found or forbidden.");
	}

	const supabase = await createClient();
	const { data, error } = await supabase.rpc("get_trade_presence", {
		p_trade_id: participantContext.tradeId,
	});

	if (error) {
		throw new Error(`Failed to fetch trade presence: ${error.message}`);
	}

	const rows = (data ?? []) as TradePresenceRow[];
	const presenceByUserId = new Map(
		rows.map((row) => [
			row.user_id,
			{
				isOnline: Boolean(row.is_active),
				lastSeenAt: normalizeTimestamp(row.last_heartbeat_at),
			},
		]),
	);

	const me = {
		isOnline: presenceByUserId.get(userId)?.isOnline ?? false,
		lastSeenAt: presenceByUserId.get(userId)?.lastSeenAt ?? null,
		userId,
	};

	const counterparty = {
		isOnline: presenceByUserId.get(participantContext.counterpartyId)?.isOnline ?? false,
		lastSeenAt: presenceByUserId.get(participantContext.counterpartyId)?.lastSeenAt ?? null,
		userId: participantContext.counterpartyId,
	};

	return {
		counterparty,
		me,
		state: deriveState(me.isOnline, counterparty.isOnline),
		tradeId: participantContext.tradeId,
	};
}
