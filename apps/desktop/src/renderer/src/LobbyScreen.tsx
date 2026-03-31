import React, { useEffect, useState } from "react";
import type { TradeDetail, LobbyStateEvent } from "../shared/ipc-types";

interface Props {
  tradeId: string;
  onClose: () => void;
  onTransferStarted: () => void;
}

function QualityBadge({ quality }: { quality: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded border border-[#2a2218] bg-[#0d0d0d] text-[#7a6e5f] font-mono">
      {quality}
    </span>
  );
}

interface LegCardProps {
  label: string;
  leg: TradeDetail["myLeg"];
}

function LegCard({ label, leg }: LegCardProps) {
  return (
    <div className="flex-1 rounded border border-[#2a2218] bg-[#111008] p-4 flex flex-col gap-2">
      <p className="text-xs uppercase tracking-widest text-[#4a4035] mb-1">{label}</p>
      <p className="text-[#e8dcc8] font-medium text-sm leading-snug">{leg.title}</p>
      <p className="text-[#7a6e5f] text-xs">{leg.artist}</p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-xs text-[#4a4035]">{leg.format}</span>
        <QualityBadge quality={leg.quality} />
      </div>
      {leg.notes && (
        <p className="text-[#4a4035] text-xs mt-1 italic">{leg.notes}</p>
      )}
      {leg.fileSizeBytes !== null && (
        <p className="text-[#4a4035] text-xs font-mono">
          {(leg.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}
    </div>
  );
}

export function LobbyScreen({ tradeId, onClose, onTransferStarted }: Props) {
  const [detail, setDetail] = useState<TradeDetail | null>(null);
  const [lobbyState, setLobbyState] = useState<LobbyStateEvent | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    window.desktopBridge
      .getTradeDetail(tradeId)
      .then((d) => setDetail(d))
      .catch(() => setLoadError(true));
  }, [tradeId]);

  useEffect(() => {
    const unsub = window.desktopBridge.onLobbyStateChanged((event) => {
      setLobbyState(event);
    });
    return unsub;
  }, []);

  async function handleStartTransfer() {
    if (starting) return;
    setStarting(true);
    try {
      await window.desktopBridge.startTransfer(tradeId);
      onTransferStarted();
    } finally {
      setStarting(false);
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d0d] items-center justify-center gap-4">
        <p className="text-[#e8dcc8] text-sm">Failed to load trade</p>
        <button
          type="button"
          onClick={() => {
            setLoadError(false);
            window.desktopBridge
              .getTradeDetail(tradeId)
              .then((d) => setDetail(d))
              .catch(() => setLoadError(true));
          }}
          className="text-xs text-[#c8914a] hover:text-[#e8a85a] transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-col h-full bg-[#0d0d0d] items-center justify-center">
        <span className="text-[#c8914a] text-sm tracking-widest uppercase animate-pulse">
          Loading trade details…
        </span>
      </div>
    );
  }

  const canStart =
    lobbyState !== null && lobbyState.bothOnline && lobbyState.leaseHolder === "me";

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e8dcc8]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2218] bg-[#111008]">
        <button
          type="button"
          onClick={onClose}
          className="text-[#7a6e5f] hover:text-[#e8dcc8] text-sm transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-sm font-medium text-[#e8dcc8]">
          Trade with {detail.counterpartyUsername}
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6">
        {/* Proposal columns */}
        <div className="flex items-stretch gap-3">
          <LegCard label="You offer" leg={detail.myLeg} />

          {/* Exchange icon */}
          <div className="flex items-center justify-center text-[#4a4035] text-lg select-none flex-shrink-0">
            &#8596;
          </div>

          <LegCard label="They offer" leg={detail.counterpartyLeg} />
        </div>

        {/* Presence indicator */}
        <div className="flex items-center gap-3 rounded border border-[#2a2218] bg-[#111008] px-4 py-3">
          <span
            className={[
              "w-2 h-2 rounded-full flex-shrink-0",
              lobbyState?.bothOnline
                ? "bg-green-500 animate-pulse"
                : "bg-[#4a4035]",
            ].join(" ")}
          />
          <span className="text-sm text-[#7a6e5f]">
            {lobbyState?.bothOnline
              ? "Both online — ready to start"
              : "Waiting for counterparty…"}
          </span>
        </div>

        {/* Lease note */}
        {lobbyState?.leaseHolder && (
          <p className="text-xs text-[#4a4035] text-center">
            {lobbyState.leaseHolder === "me"
              ? "You are the transfer initiator"
              : "Counterparty initiates transfer"}
          </p>
        )}

        {/* Start Transfer CTA */}
        <button
          type="button"
          disabled={!canStart || starting}
          onClick={handleStartTransfer}
          className={[
            "w-full py-3 rounded text-sm font-medium tracking-wide transition-colors",
            canStart && !starting
              ? "bg-[#c8914a] hover:bg-[#e8a85a] text-[#0d0d0d]"
              : "bg-[#2a2218] text-[#4a4035] cursor-not-allowed opacity-50",
          ].join(" ")}
        >
          {starting ? "Starting…" : "Start Transfer"}
        </button>

        {/* Expiry note */}
        {detail.expiresAt && (
          <p className="text-xs text-[#4a4035] text-center">
            Lobby expires{" "}
            {new Date(detail.expiresAt).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
