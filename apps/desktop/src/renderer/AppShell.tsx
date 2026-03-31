import React, { useEffect, useState } from "react";
import type { SupabaseSession } from "../shared/ipc-types";
import { LoginScreen } from "./LoginScreen";
import { InboxScreen } from "./InboxScreen";
import { SettingsScreen } from "./SettingsScreen";

type Tab = "inbox" | "settings";

export function AppShell() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SupabaseSession | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("inbox");

  useEffect(() => {
    window.desktopBridge
      .getSession()
      .then((s) => setSession(s))
      .finally(() => setLoading(false));
  }, []);

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
    <div className="flex flex-col h-screen bg-[#0d0d0d] text-[#e8dcc8]">
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
          <InboxScreen session={session} />
        ) : (
          <SettingsScreen session={session} onSignOut={() => setSession(null)} />
        )}
      </main>
    </div>
  );
}
