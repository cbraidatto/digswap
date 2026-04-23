"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
	tradeId: string;
	currentStatus: string;
}

const TERMINAL_STATUSES = new Set(["completed", "declined", "cancelled", "expired"]);

/**
 * Watches trade status via Supabase Realtime.
 * Calls router.refresh() when status changes so both participants
 * see the updated UI without manually reloading.
 */
export function TradeStatusWatcher({ tradeId, currentStatus }: Props) {
	const router = useRouter();
	const statusRef = useRef(currentStatus);
	statusRef.current = currentStatus;

	useEffect(() => {
		if (TERMINAL_STATUSES.has(currentStatus)) return;

		const supabase = createClient();

		const channel = supabase
			.channel(`trade-status-${tradeId}`)
			.on(
				"postgres_changes",
				{
					event: "UPDATE",
					schema: "public",
					table: "trade_requests",
					filter: `id=eq.${tradeId}`,
				},
				(payload) => {
					const newStatus = (payload.new as { status?: string }).status;
					if (!newStatus || newStatus === statusRef.current) return;
					router.refresh();
				},
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [tradeId, router, currentStatus]);

	return null;
}
