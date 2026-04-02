import type { TradeStatus } from "@digswap/trade-domain";

export type AuthProvider = "google" | "email";

/**
 * Minimal session shape the renderer needs â€” mirrors Supabase Session,
 * without importing @supabase/supabase-js into the renderer bundle directly.
 * Preload populates this from the stored safeStorage token.
 */
export interface SupabaseSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
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

export interface DesktopStorageHealth {
  encryptionAvailable: boolean;
  backend: string | null;
  secure: boolean;
}

export interface TradeHandoffPayload {
  kind: "trade-handoff";
  tradeId: string;
  token: string;
  handoffToken?: string;
  rawUrl: string;
  receivedAt: string;
}

export interface AuthCallbackPayload {
  kind: "auth-callback";
  code: string | null;
  errorCode: string | null;
  errorDescription: string | null;
  rawUrl: string;
  receivedAt: string;
}

export type DesktopProtocolPayload = TradeHandoffPayload | AuthCallbackPayload;

export interface PendingTrade {
  tradeId: string;
  counterpartyUsername: string;
  counterpartyAvatarUrl: string | null;
  status: TradeStatus;
  updatedAt: string;
  /**
   * Compatibility shim for the current renderer contract.
   * Inbox-originated opens tunnel the trade id here until 17-06 renames it.
   */
  handoffToken: string;
}

export interface DesktopBootstrapState {
  appVersion: string;
  configError: string | null;
  storage: DesktopStorageHealth;
  settings: DesktopSettings;
  session: SupabaseSession | null;
  lastProtocolPayload: DesktopProtocolPayload | null;
}

export interface DesktopShellSessionPayload {
  accessToken: string;
  refreshToken: string;
}

/**
 * Minimal shell bridge exposed to the remote DigSwap web app.
 * This must stay tiny because the main BrowserWindow loads remote content.
 */
export interface DesktopMainShellBridge {
  isDesktop(): boolean;
  getAppVersion(): Promise<string>;
  syncSession(session: DesktopShellSessionPayload | null): Promise<void>;
}

/**
 * The IPC bridge exposed on window.desktopBridge by the Electron preload script.
 * Renderer calls these methods; the main process is the only place that touches
 * Electron or Supabase directly.
 */
export interface DesktopBridge {
  getBootstrapState(): Promise<DesktopBootstrapState>;
  getSession(): Promise<SupabaseSession | null>;
  openOAuth(provider: AuthProvider): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  signOut(): Promise<void>;
  getPendingTrades(): Promise<PendingTrade[]>;
  openTradeFromHandoff(handoffToken: string): Promise<void>;
  getSettings(): Promise<DesktopSettings>;
  setSettings(settings: Partial<DesktopSettings>): Promise<void>;
  selectDownloadPath(): Promise<string | null>;
  getAppVersion(): Promise<string>;
  onProtocolPayload(listener: (payload: DesktopProtocolPayload) => void): () => void;
  onSessionChanged(listener: (session: SupabaseSession | null) => void): () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// TRADE RUNTIME — defined by 17-06 Claude (renderer); implemented by 17-06 Codex (main)
// ─────────────────────────────────────────────────────────────────────────────

/** Metadata for one side of a trade proposal leg. */
export interface TradeLeg {
  title: string;
  artist: string;
  format: string;
  quality: string;
  notes: string | null;
  fileNameHint: string | null;
  fileSizeBytes: number | null;
}

/** Full proposal context shown in LobbyScreen. */
export interface TradeDetail {
  tradeId: string;
  status: TradeStatus;
  myLeg: TradeLeg;
  counterpartyLeg: TradeLeg;
  counterpartyUsername: string;
  counterpartyAvatarUrl: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/** Fired by onTransferProgress listener as chunks arrive. */
export interface TransferProgressEvent {
  bytesReceived: number;
  totalBytes: number;
  peerConnected: boolean;
}

/** Fired once by onTransferComplete when all chunks verified. */
export interface TransferCompleteEvent {
  filePath: string;
  sha256: string;
  tradeId: string;
}

/** Fired by onLobbyStateChanged when lease or presence changes. */
export interface LobbyStateEvent {
  status: TradeStatus;
  bothOnline: boolean;
  leaseHolder: "me" | "counterparty" | null;
}

/** Extend DesktopBridge with trade runtime methods (Codex implements). */
export interface DesktopBridgeTradeRuntime {
  getTradeDetail(tradeId: string): Promise<TradeDetail>;
  startTransfer(tradeId: string): Promise<void>;
  cancelTransfer(tradeId: string): Promise<void>;
  confirmCompletion(tradeId: string, rating: number): Promise<void>;
  openFileInExplorer(filePath: string): Promise<void>;
  onTransferProgress(listener: (event: TransferProgressEvent) => void): () => void;
  onTransferComplete(listener: (event: TransferCompleteEvent) => void): () => void;
  onLobbyStateChanged(listener: (event: LobbyStateEvent) => void): () => void;
}

declare global {
  interface Window {
    desktopShell?: DesktopMainShellBridge;
    // Augment: trade runtime methods merged at runtime by the preload script
    desktopBridge: DesktopBridge & DesktopBridgeTradeRuntime;
  }
}

export {};
