import React, { useState } from "react";
import type { SupabaseSession } from "../../shared/ipc-types";

interface Props {
  onAuthenticated: (session: SupabaseSession) => void;
}

export function LoginScreen({ onAuthenticated }: Props) {
  const [loading, setLoading] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  async function handleOAuth() {
    setLoading("google");
    setError(null);
    try {
      await window.desktopBridge.openOAuth("google");
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

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading("email");
    setError(null);
    try {
      await window.desktopBridge.sendMagicLink(email.trim());
      setMagicLinkSent(true);
      // Wait for the auth callback — bridge resolves when digswap://auth/callback fires
      const session = await window.desktopBridge.getSession();
      if (session) {
        onAuthenticated(session);
      } else {
        setError("Magic link used but no session found. Try again.");
        setMagicLinkSent(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setMagicLinkSent(false);
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

        {!showEmailForm ? (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={loading !== null}
              onClick={handleOAuth}
              className="flex items-center justify-center gap-2 rounded border border-[#2a2218] bg-[#1a1710] px-4 py-2.5 text-sm text-[#e8dcc8] hover:bg-[#221f14] disabled:opacity-50 transition-colors"
            >
              {loading === "google" ? "Opening browser…" : "Sign in with Google"}
            </button>
            <button
              type="button"
              disabled={loading !== null}
              onClick={() => setShowEmailForm(true)}
              className="flex items-center justify-center gap-2 rounded border border-[#2a2218] bg-[#1a1710] px-4 py-2.5 text-sm text-[#e8dcc8] hover:bg-[#221f14] disabled:opacity-50 transition-colors"
            >
              Sign in with Email
            </button>
          </div>
        ) : magicLinkSent ? (
          <div className="flex flex-col gap-3 text-center">
            <p className="text-[#7ac87a] text-sm">Magic link sent!</p>
            <p className="text-[#7a6e5f] text-xs leading-relaxed">
              Check <span className="text-[#e8dcc8]">{email}</span> and click the link.
              This window will update automatically.
            </p>
            <button
              type="button"
              onClick={() => { setMagicLinkSent(false); setShowEmailForm(false); setEmail(""); }}
              className="text-[#4a4035] hover:text-[#7a6e5f] text-xs transition-colors"
            >
              Use a different method
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="rounded border border-[#2a2218] bg-[#0d0d0d] px-3 py-2.5 text-sm text-[#e8dcc8] placeholder-[#4a4035] outline-none focus:border-[#c8914a]/50 transition-colors"
            />
            <button
              type="submit"
              disabled={loading === "email" || !email.trim()}
              className="rounded bg-[#c8914a] px-4 py-2.5 text-sm font-bold text-[#0d0d0d] hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading === "email" ? "Sending…" : "Send Magic Link"}
            </button>
            <button
              type="button"
              onClick={() => { setShowEmailForm(false); setError(null); }}
              className="text-[#4a4035] hover:text-[#7a6e5f] text-xs transition-colors"
            >
              ← Back
            </button>
          </form>
        )}

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {!showEmailForm && (
          <p className="text-[#4a4035] text-xs text-center leading-relaxed">
            Sign-in opens your system browser. Your session is stored securely using OS keychain encryption.
          </p>
        )}
      </div>
    </div>
  );
}
