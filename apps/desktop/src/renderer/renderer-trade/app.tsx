import React, { useEffect, useState } from "react";
import type { DesktopProtocolPayload, TransferCompleteEvent } from "../../shared/ipc-types";
import { LobbyScreen } from "./LobbyScreen";
import { TransferScreen } from "./TransferScreen";
import { CompletionScreen } from "./CompletionScreen";

type Phase = "lobby" | "transfer" | "completion";

interface ActiveTrade {
  tradeId: string;
  phase: Phase;
  completionEvent: TransferCompleteEvent | null;
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
      <span className="text-[#c8914a] text-sm tracking-widest uppercase animate-pulse">
        Loading…
      </span>
    </div>
  );
}

function IdleState() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#0d0d0d] text-center px-6">
      <span className="text-3xl select-none">🎵</span>
      <p className="text-[#e8dcc8] text-sm font-medium">Waiting for trade</p>
      <p className="text-[#7a6e5f] text-xs max-w-xs leading-relaxed">
        Open a trade from the DigSwap web app — it will appear here automatically.
      </p>
    </div>
  );
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

  useEffect(() => {
    window.desktopBridge
      .getBootstrapState()
      .then((state) => {
        if (state.lastProtocolPayload?.kind === "trade-handoff") {
          openTrade(state.lastProtocolPayload.tradeId);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsub = window.desktopBridge.onProtocolPayload((payload: DesktopProtocolPayload) => {
      if (payload.kind === "trade-handoff") {
        openTrade(payload.tradeId);
      }
    });
    return unsub;
  }, []);

  function openTrade(tradeId: string) {
    setActiveTrade({ tradeId, phase: "lobby", completionEvent: null });
  }

  function handleTransferStarted() {
    setActiveTrade((prev) => prev ? { ...prev, phase: "transfer" } : prev);
  }

  function handleTransferComplete(event: TransferCompleteEvent) {
    setActiveTrade((prev) => prev ? { ...prev, phase: "completion", completionEvent: event } : prev);
  }

  function handleClose() {
    setActiveTrade(null);
  }

  if (loading) return <Spinner />;

  if (!activeTrade) return <IdleState />;

  const { tradeId, phase, completionEvent } = activeTrade;

  if (phase === "lobby") {
    return (
      <LobbyScreen
        tradeId={tradeId}
        onClose={handleClose}
        onTransferStarted={handleTransferStarted}
      />
    );
  }

  if (phase === "transfer") {
    return (
      <TransferScreen
        tradeId={tradeId}
        onComplete={handleTransferComplete}
        onCancel={handleClose}
      />
    );
  }

  if (phase === "completion" && completionEvent) {
    return <CompletionScreen event={completionEvent} onDone={handleClose} />;
  }

  return <IdleState />;
}
