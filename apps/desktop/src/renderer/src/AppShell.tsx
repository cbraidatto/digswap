import React, { useEffect, useState } from "react";
import type {
  AudioPrepResult,
  DesktopProtocolPayload,
  SupabaseSession,
  TransferCompleteEvent,
} from "../../shared/ipc-types";
import { LoginScreen } from "./LoginScreen";
import { InboxScreen } from "./InboxScreen";
import { SettingsScreen } from "./SettingsScreen";
import { LobbyScreen } from "./LobbyScreen";
import { AudioPrepScreen } from "./AudioPrepScreen";
import { TransferScreen } from "./TransferScreen";
import { CompletionScreen } from "./CompletionScreen";
import { LibraryScreen } from "./LibraryScreen";

type Tab = "inbox" | "settings" | "library";

export function AppShell() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // Trade overlay state
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [tradePhase, setTradePhase] = useState<"lobby" | "audio-prep" | "transfer" | "completion">("lobby");
  const [completionEvent, setCompletionEvent] = useState<TransferCompleteEvent | null>(null);
  const [audioPrepResults, setAudioPrepResults] = useState<AudioPrepResult[]>([]);

  useEffect(() => {
    window.desktopBridge
      .getBootstrapState()
      .then((state) => {
        setSession(state.session);
        if (state.session && state.lastProtocolPayload?.kind === "trade-handoff") {
          handleOpenTrade(state.lastProtocolPayload.tradeId);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!session) return;
    const unsub = window.desktopBridge.onProtocolPayload((payload: DesktopProtocolPayload) => {
      if (payload.kind === "trade-handoff") {
        handleOpenTrade(payload.tradeId);
      }
    });
    return unsub;
  }, [session]);

  function handleOpenTrade(tradeId: string) {
    setActiveTradeId(tradeId);
    setTradePhase("lobby");
  }

  function handleTradeClose() {
    setActiveTradeId(null);
  }

  function handleTransferStarted() {
    // Route through audio-prep phase before transfer
    // TODO: Check if trade has items that lack previewStoragePath once TradeDetail
    // is extended with multi-item data. For now, always show audio-prep for new flow.
    setTradePhase("audio-prep");
  }

  function handleAudioPrepComplete(_results: AudioPrepResult[]) {
    setAudioPrepResults(_results);
    setTradePhase("transfer");
  }

  function handleAudioPrepCancel() {
    setTradePhase("lobby");
  }

  function handleTransferComplete(event: TransferCompleteEvent) {
    setCompletionEvent(event);
    setTradePhase("completion");
  }

  function handleTransferCancel() {
    setActiveTradeId(null);
  }

  function handleTradeDone() {
    setActiveTradeId(null);
    setCompletionEvent(null);
    setAudioPrepResults([]);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
        <span className="text-[#c8914a] text-sm tracking-widest uppercase animate-pulse">
          Loading…
        </span>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onAuthenticated={(s) => setSession(s)} />;
  }

  return (
    <div className="relative flex flex-col h-screen bg-[#0d0d0d] text-[#e8dcc8]">
      {/* Tab bar */}
      <nav className="flex items-center gap-0 border-b border-[#2a2218] bg-[#111008]">
        {(["inbox", "library", "settings"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "px-6 py-3 text-sm font-medium tracking-wide uppercase transition-colors",
              activeTab === tab
                ? "text-[#c8914a] border-b-2 border-[#c8914a]"
                : "text-[#7a6e5f] hover:text-[#e8dcc8]",
            ].join(" ")}
          >
            {tab === "inbox" ? "Trades" : tab === "library" ? "Biblioteca" : "Settings"}
          </button>
        ))}
      </nav>

      {/* Screen area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "inbox" ? (
          <InboxScreen session={session} onOpenTrade={handleOpenTrade} />
        ) : activeTab === "library" ? (
          <LibraryScreen />
        ) : (
          <SettingsScreen session={session} onSignOut={() => setSession(null)} />
        )}
      </main>

      {/* Trade overlay — absolute inset-0 z-10, rendered on top of tab shell when trade is active */}
      {activeTradeId && (
        <div className="absolute inset-0 z-10 bg-[#0d0d0d] flex flex-col">
          {tradePhase === "lobby" && (
            <LobbyScreen
              tradeId={activeTradeId}
              onClose={handleTradeClose}
              onTransferStarted={handleTransferStarted}
            />
          )}
          {tradePhase === "audio-prep" && (
            <AudioPrepScreen
              tradeId={activeTradeId}
              /* Stub proposalItems: full multi-item data threading comes with Phase 28 TradeDetail extension */
              proposalItems={[{ id: activeTradeId, title: "Item 1", artist: "" }]}
              onComplete={handleAudioPrepComplete}
              onCancel={handleAudioPrepCancel}
            />
          )}
          {tradePhase === "transfer" && (
            <TransferScreen
              tradeId={activeTradeId}
              onComplete={handleTransferComplete}
              onCancel={handleTransferCancel}
            />
          )}
          {tradePhase === "completion" && completionEvent && (
            <CompletionScreen event={completionEvent} onDone={handleTradeDone} />
          )}
        </div>
      )}
    </div>
  );
}
