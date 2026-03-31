import React, { useEffect, useState } from "react";
import type { SupabaseSession, TransferCompleteEvent } from "../shared/ipc-types";
import { LoginScreen } from "./LoginScreen";
import { InboxScreen } from "./InboxScreen";
import { SettingsScreen } from "./SettingsScreen";
import { LobbyScreen } from "./LobbyScreen";
import { TransferScreen } from "./TransferScreen";
import { CompletionScreen } from "./CompletionScreen";

type Tab = "inbox" | "settings";

export function AppShell() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  // Trade overlay state
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);
  const [tradePhase, setTradePhase] = useState<"lobby" | "transfer" | "completion">("lobby");
  const [completionEvent, setCompletionEvent] = useState<TransferCompleteEvent | null>(null);

  useEffect(() => {
    window.desktopBridge
      .getSession()
      .then((s) => setSession(s))
      .finally(() => setLoading(false));
  }, []);

  function handleOpenTrade(tradeId: string) {
    setActiveTradeId(tradeId);
    setTradePhase("lobby");
  }

  function handleTradeClose() {
    setActiveTradeId(null);
  }

  function handleTransferStarted() {
    setTradePhase("transfer");
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
        {(["inbox", "settings"] as Tab[]).map((tab) => (
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
            {tab === "inbox" ? "Trades" : "Settings"}
          </button>
        ))}
      </nav>

      {/* Screen area */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "inbox" ? (
          <InboxScreen session={session} onOpenTrade={handleOpenTrade} />
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
