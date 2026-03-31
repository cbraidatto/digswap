import React, { useState } from "react";
import type { SupabaseSession } from "../shared/ipc-types";

interface Props {
  onAuthenticated: (session: SupabaseSession) => void;
}

export function LoginScreen({ onAuthenticated }: Props) {
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOAuth(provider: "google" | "email") {
    setLoading(provider);
    setError(null);
    try {
      await window.desktopBridge.openOAuth(provider);
      const session = await window.desktopBridge.getSession();
      if (session) {
        onAuthenticated(session);
      } else {
        setError("Sign-in completed but no session was found. Try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-[#0d0d0d]">
      <div className="w-80 rounded-lg border border-[#2a2218] bg-[#111008] p-8 flex flex-col gap-6">
        {/* Wordmark */}
        <div className="text-center">
          <span className="text-[#c8914a] text-2xl font-bold tracking-widest uppercase">
            DigSwap
          </span>
          <p className="mt-1 text-[#7a6e5f] text-xs tracking-wide">Desktop Trade Client</p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handleOAuth("google")}
            className="flex items-center justify-center gap-2 rounded border border-[#2a2218] bg-[#1a1710] px-4 py-2.5 text-sm text-[#e8dcc8] hover:bg-[#221f14] disabled:opacity-50 transition-colors"
          >
            {loading === "google" ? "Opening browser…" : "Sign in with Google"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => handleOAuth("email")}
            className="flex items-center justify-center gap-2 rounded border border-[#2a2218] bg-[#1a1710] px-4 py-2.5 text-sm text-[#e8dcc8] hover:bg-[#221f14] disabled:opacity-50 transition-colors"
          >
            {loading === "email" ? "Opening browser…" : "Sign in with Email"}
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <p className="text-[#4a4035] text-xs text-center leading-relaxed">
          Sign-in opens your system browser. Your session is stored securely using OS keychain encryption.
        </p>
      </div>
    </div>
  );
}
