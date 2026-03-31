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
  handoffToken: string;
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

/**
 * The IPC bridge exposed on window.desktopBridge by the Electron preload script.
 * Renderer calls these methods; the main process is the only place that touches
 * Electron or Supabase directly.
 */
export interface DesktopBridge {
  getBootstrapState(): Promise<DesktopBootstrapState>;
  getSession(): Promise<SupabaseSession | null>;
  openOAuth(provider: AuthProvider): Promise<void>;
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

declare global {
  interface Window {
    desktopBridge: DesktopBridge;
  }
}

export {};
