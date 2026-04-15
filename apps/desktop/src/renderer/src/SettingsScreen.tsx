import React, { useCallback, useEffect, useState } from "react";
import type { DesktopSettings, SupabaseSession } from "../../shared/ipc-types";

interface Props {
  session: SupabaseSession;
  onSignOut: () => void;
}

export function SettingsScreen({ session, onSignOut }: Props) {
  const [settings, setSettingsState] = useState<DesktopSettings | null>(null);
  const [appVersion, setAppVersion] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Gemini API Key state
  const [geminiKey, setGeminiKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [removeConfirm, setRemoveConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      window.desktopBridge.getSettings(),
      window.desktopBridge.getAppVersion(),
      window.desktopBridge.getGeminiApiKey(),
    ]).then(([s, v, gKey]) => {
      setSettingsState(s);
      setAppVersion(v);
      setGeminiKey(gKey);
    });
  }, []);

  async function handleChangeDownloadPath() {
    const newPath = await window.desktopBridge.selectDownloadPath();
    if (!newPath || !settings) return;
    setSaving(true);
    try {
      await window.desktopBridge.setSettings({ downloadPath: newPath });
      setSettingsState({ ...settings, downloadPath: newPath });
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateChannelChange(channel: "stable" | "beta") {
    if (!settings) return;
    setSaving(true);
    try {
      await window.desktopBridge.setSettings({ updateChannel: channel });
      setSettingsState({ ...settings, updateChannel: channel });
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await window.desktopBridge.signOut();
      onSignOut();
    } finally {
      setSigningOut(false);
    }
  }

  // Gemini API Key handlers
  const handleSaveGeminiKey = useCallback(async () => {
    if (!newKeyValue.trim()) return;
    await window.desktopBridge.setGeminiApiKey(newKeyValue.trim());
    setGeminiKey(newKeyValue.trim());
    setEditingKey(false);
    setNewKeyValue("");
  }, [newKeyValue]);

  const handleRemoveGeminiKey = useCallback(async () => {
    if (!removeConfirm) {
      setRemoveConfirm(true);
      // Revert confirmation after 3 seconds if not clicked again
      setTimeout(() => setRemoveConfirm(false), 3000);
      return;
    }
    // Second click within 3-second window: execute removal
    await window.desktopBridge.removeGeminiApiKey();
    setGeminiKey(null);
    setRemoveConfirm(false);
  }, [removeConfirm]);

  /** Mask a key for display: show first 4 + last 4 chars */
  function maskKey(key: string): string {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full p-12">
        <span className="text-[#7a6e5f] text-sm animate-pulse">Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 max-w-md">
      <h1 className="text-[#7a6e5f] text-xs uppercase tracking-widest">Settings</h1>

      {/* Download Path */}
      <section className="flex flex-col gap-2">
        <label className="text-[#e8dcc8] text-sm font-medium">Download Path</label>
        <div className="flex items-center gap-2">
          <span className="flex-1 text-[#7a6e5f] text-xs font-mono truncate bg-[#111008] border border-[#2a2218] rounded px-3 py-2">
            {settings.downloadPath}
          </span>
          <button
            type="button"
            disabled={saving}
            onClick={handleChangeDownloadPath}
            className="text-xs font-medium text-[#c8914a] hover:text-[#e8a85a] disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            Change
          </button>
        </div>
        <p className="text-[#4a4035] text-xs">
          Received files are saved to: {settings.downloadPath}/DigSwap/Incoming/
        </p>
      </section>

      {/* Update Channel */}
      <section className="flex flex-col gap-2">
        <label className="text-[#e8dcc8] text-sm font-medium">Update Channel</label>
        <div className="flex gap-2">
          {(["stable", "beta"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              disabled={saving}
              onClick={() => handleUpdateChannelChange(ch)}
              className={[
                "px-4 py-1.5 rounded border text-xs font-medium transition-colors capitalize",
                settings.updateChannel === ch
                  ? "border-[#c8914a] text-[#c8914a] bg-[#c8914a]/10"
                  : "border-[#2a2218] text-[#7a6e5f] hover:text-[#e8dcc8]",
              ].join(" ")}
            >
              {ch}
            </button>
          ))}
        </div>
      </section>

      {/* Gemini API Key (Phase 32) */}
      <section className="flex flex-col gap-2">
        <label className="text-[#e8dcc8] text-sm font-medium">Gemini API Key</label>

        {editingKey ? (
          <>
            <input
              type="text"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="AIza..."
              className="bg-[#0d0d0d] border border-[#2a2218] rounded px-3 py-2 text-sm font-mono text-[#e8dcc8] placeholder-[#4a4035] w-full"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleSaveGeminiKey}
                disabled={!newKeyValue.trim()}
                className="text-xs font-medium text-[#c8914a] disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => { setEditingKey(false); setNewKeyValue(""); }}
                className="text-xs font-medium text-[#4a4035]"
              >
                Cancelar
              </button>
            </div>
          </>
        ) : geminiKey ? (
          <>
            <span className="text-[#7a6e5f] text-xs font-mono bg-[#111008] border border-[#2a2218] rounded px-3 py-2">
              {maskKey(geminiKey)}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setEditingKey(true); setNewKeyValue(""); }}
                className="text-xs font-medium text-[#c8914a] hover:text-[#e8a85a]"
              >
                Alterar chave
              </button>
              <button
                type="button"
                onClick={handleRemoveGeminiKey}
                className={`text-xs font-medium transition-colors ${
                  removeConfirm
                    ? "text-red-300"
                    : "text-red-400 hover:text-red-300"
                }`}
              >
                {removeConfirm ? "Confirmar remocao?" : "Remover chave"}
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="text-[#4a4035] text-xs">Nao configurada</span>
            <button
              type="button"
              onClick={() => setEditingKey(true)}
              className="w-fit text-xs font-medium text-[#c8914a] hover:text-[#e8a85a]"
            >
              Configurar chave API
            </button>
          </>
        )}

        <p className="text-[#4a4035] text-xs">
          Obtenha em ai.google.dev/aistudio — o plano gratuito permite 500 solicitacoes/dia.
        </p>
      </section>

      {/* Account */}
      <section className="flex flex-col gap-2">
        <label className="text-[#e8dcc8] text-sm font-medium">Account</label>
        <p className="text-[#7a6e5f] text-xs">{session.user.email ?? "Unknown email"}</p>
        <p className="text-[#4a4035] text-xs">App version {appVersion || "—"}</p>
        <button
          type="button"
          disabled={signingOut}
          onClick={handleSignOut}
          className="mt-1 w-fit text-xs font-medium text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
        >
          {signingOut ? "Signing out..." : "Sign Out"}
        </button>
      </section>
    </div>
  );
}
