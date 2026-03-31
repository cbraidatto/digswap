import React, { useEffect, useState, useCallback } from "react";
import { TRADE_STATUS } from "@digswap/trade-domain";
import type { TradeStatus } from "@digswap/trade-domain";
import type { PendingTrade, SupabaseSession } from "../shared/ipc-types";

interface Props {
  session: SupabaseSession;
  onOpenTrade: (tradeId: string) => void;
}

const STATUS_LABELS: Record<TradeStatus, { label: string; className: string }> = {
  [TRADE_STATUS.PENDING]: { label: "Pending", className: "bg-amber-900/40 text-amber-300" },
  [TRADE_STATUS.LOBBY]: { label: "Lobby", className: "bg-amber-900/40 text-amber-300" },
  [TRADE_STATUS.PREVIEWING]: { label: "Previewing", className: "bg-blue-900/40 text-blue-300" },
  [TRADE_STATUS.ACCEPTED]: { label: "Accepted", className: "bg-blue-900/40 text-blue-300" },
  [TRADE_STATUS.TRANSFERRING]: {
    label: "Transferring",
    className: "bg-green-900/40 text-green-300 animate-pulse",
  },
  [TRADE_STATUS.COMPLETED]: { label: "Completed", className: "bg-green-900/20 text-green-600" },
  [TRADE_STATUS.DECLINED]: { label: "Declined", className: "bg-red-900/20 text-red-500" },
  [TRADE_STATUS.CANCELLED]: { label: "Cancelled", className: "bg-neutral-800 text-neutral-500" },
  [TRADE_STATUS.EXPIRED]: { label: "Expired", className: "bg-neutral-800 text-neutral-500" },
};

const ACTIVE_STATUSES: TradeStatus[] = [
  TRADE_STATUS.PENDING,
  TRADE_STATUS.LOBBY,
  TRADE_STATUS.PREVIEWING,
  TRADE_STATUS.ACCEPTED,
  TRADE_STATUS.TRANSFERRING,
];

export function InboxScreen({ session: _session, onOpenTrade }: Props) {
  const [trades, setTrades] = useState<PendingTrade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    try {
      const result = await window.desktopBridge.getPendingTrades();
      setTrades(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrades();
    const interval = setInterval(fetchTrades, 30_000);
    return () => clearInterval(interval);
  }, [fetchTrades]);

  function handleOpenTrade(trade: PendingTrade) {
    onOpenTrade(trade.tradeId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <span className="text-[#7a6e5f] text-sm animate-pulse">Loading trades…</span>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-12 text-center">
        <span className="text-4xl">🎵</span>
        <p className="text-[#e8dcc8] text-sm font-medium">No pending trades</p>
        <p className="text-[#7a6e5f] text-xs max-w-xs">
          Start a trade from the DigSwap web app — it will appear here once both parties accept the
          proposal.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 flex flex-col gap-2">
      <h1 className="text-[#7a6e5f] text-xs uppercase tracking-widest mb-2">Active Trades</h1>
      {trades.map((trade) => {
        const badge = STATUS_LABELS[trade.status];
        const isActive = ACTIVE_STATUSES.includes(trade.status);

        return (
          <div
            key={trade.tradeId}
            className="flex items-center gap-3 rounded border border-[#2a2218] bg-[#111008] p-3"
          >
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-[#1a1710] border border-[#2a2218] overflow-hidden flex-shrink-0">
              {trade.counterpartyAvatarUrl ? (
                <img
                  src={trade.counterpartyAvatarUrl}
                  alt={trade.counterpartyUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="flex items-center justify-center h-full text-[#c8914a] text-sm font-bold">
                  {trade.counterpartyUsername[0]?.toUpperCase() ?? "?"}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-[#e8dcc8] text-sm font-medium truncate">
                {trade.counterpartyUsername}
              </p>
              <p className="text-[#4a4035] text-xs">
                {new Date(trade.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            {/* Status badge */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
              {badge.label}
            </span>

            {/* CTA */}
            {isActive && (
              <button
                type="button"
                onClick={() => handleOpenTrade(trade)}
                className="ml-1 text-xs font-medium text-[#c8914a] hover:text-[#e8a85a] transition-colors whitespace-nowrap"
              >
                Open Trade
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
