import type { TradeStatus } from "@digswap/trade-domain";

/**
 * Minimal session shape the renderer needs — mirrors Supabase Session,
 * without importing @supabase/supabase-js into the renderer bundle directly.
 * Preload populates this from the stored safeStorage token.
 */
export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
  user: {
    id: string;
    email: string | null;
    userMetadata: {
      full_name?: string;
      avatar_url?: string;
      name?: string;
    };
  };
}

export interface DesktopSettings {
  downloadPath: string;
  updateChannel: "stable" | "beta";
}

export interface PendingTrade {
  tradeId: string;
  counterpartyUsername: string;
  counterpartyAvatarUrl: string | null;
  status: TradeStatus;
  /** ISO 8601 datetime */
  updatedAt: string;
  /** Short-TTL handoff token used to open the trade lobby */
  handoffToken: string;
}

/**
 * The IPC bridge exposed on window.desktopBridge by the Electron preload script.
 * Renderer calls these methods; Codex implements them in apps/desktop/src/preload.ts.
 *
 * Contract rules:
 * - All methods are async (return Promise) — IPC is always async.
 * - Methods that write state return void.
 * - The renderer NEVER calls require('electron') directly — only via this bridge.
 */
export interface DesktopBridge {
  /** Returns the stored session or null if none/expired. */
  getSession(): Promise<SupabaseSession | null>;

  /**
   * Opens the system browser to the OAuth page for the given provider.
   * Resolves when the OAuth callback arrives via the digswap:// protocol handler
   * and the session has been written to safeStorage.
   * Rejects on timeout (>5 min) or user cancellation.
   */
  openOAuth(provider: "google" | "email"): Promise<void>;

  /** Signs out: clears safeStorage session, resolves when done. */
  signOut(): Promise<void>;

  /** Fetches pending trades from Supabase using the stored session. */
  getPendingTrades(): Promise<PendingTrade[]>;

  /**
   * Navigates to the trade lobby for the given handoff token.
   * The desktop app opens the lobby screen in the renderer.
   * Triggers main-process navigation — renderer listens via ipcRenderer.on('navigate-to-lobby').
   */
  openTradeFromHandoff(handoffToken: string): Promise<void>;

  /** Reads current settings from Electron store (electron-store or similar). */
  getSettings(): Promise<DesktopSettings>;

  /** Persists updated settings. Partial update: only provided keys are changed. */
  setSettings(settings: Partial<DesktopSettings>): Promise<void>;

  /**
   * Opens the OS-native folder picker dialog.
   * Returns the selected path, or null if user cancelled.
   */
  selectDownloadPath(): Promise<string | null>;

  /** Returns the current app version string (from app.getVersion()). */
  getAppVersion(): Promise<string>;
}

declare global {
  interface Window {
    desktopBridge: DesktopBridge;
  }
}
