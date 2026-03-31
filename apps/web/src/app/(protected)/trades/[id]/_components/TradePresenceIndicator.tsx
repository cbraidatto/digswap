"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TradePresenceState } from "@/lib/trades/presence";

const STATE_CONFIG: Record<
	TradePresenceState,
	{ label: string; dotClass: string; textClass: string }
> = {
	both_online:       { label: "Both online",         dotClass: "bg-[#7ac87a]",  textClass: "text-[#7ac87a]" },
	me_only:           { label: "Desktop active",       dotClass: "bg-[#c8914a]",  textClass: "text-[#c8914a]" },
	counterparty_only: { label: "Counterparty online",  dotClass: "bg-[#7aa2c8]",  textClass: "text-[#7aa2c8]" },
	neither:           { label: "Offline",              dotClass: "bg-[#4a4035]",  textClass: "text-[#4a4035]" },
};

interface PresenceRow {
	is_active: boolean | null;
	last_heartbeat_at: string | null;
	user_id: string;
}

function deriveStateFromRows(rows: PresenceRow[], userId: string, counterpartyId: string): TradePresenceState {
	const me = rows.find((r) => r.user_id === userId);
	const other = rows.find((r) => r.user_id === counterpartyId);
	const meOnline = Boolean(me?.is_active);
	const otherOnline = Boolean(other?.is_active);
	if (meOnline && otherOnline) return "both_online";
	if (meOnline) return "me_only";
	if (otherOnline) return "counterparty_only";
	return "neither";
}

interface Props {
	tradeId: string;
	userId: string;
	counterpartyId: string;
	initialState: TradePresenceState;
}

export function TradePresenceIndicator({ tradeId, userId, counterpartyId, initialState }: Props) {
	const [state, setState] = useState<TradePresenceState>(initialState);

	useEffect(() => {
		const supabase = createClient();

		async function refresh() {
			const { data } = await supabase.rpc("get_trade_presence", { p_trade_id: tradeId });
			if (data) {
				setState(deriveStateFromRows(data as PresenceRow[], userId, counterpartyId));
			}
		}

		// Poll every 30 seconds — presence changes are low-frequency
		const timer = setInterval(refresh, 30_000);
		return () => clearInterval(timer);
	}, [tradeId, userId, counterpartyId]);

	const config = STATE_CONFIG[state];

	return (
		<div className="flex items-center gap-1.5">
			<span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dotClass}`} />
			<span className={`font-mono text-[10px] ${config.textClass}`}>{config.label}</span>
		</div>
	);
}
