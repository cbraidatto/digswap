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
  autoStart: boolean;
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
  /**
   * Handoff-code flow: the web app sends a single-use code (30s TTL)
   * instead of raw tokens. The desktop exchanges it server-side via
   * POST /api/desktop/session/exchange, keeping tokens out of the browser.
   */
  syncHandoffCode(code: string | null): Promise<void>;
  /** Enable or disable launching at system login (boot-to-tray). */
  setAutoStart(enabled: boolean): Promise<void>;
  /** Check whether auto-start is currently enabled. */
  getAutoStart(): Promise<boolean>;
  /** Listen for startup diff scan results. */
  onDiffScanResult(listener: (result: DiffScanResult) => void): () => void;
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
  /** SHA-256 hash declared by the provider when they committed the file. */
  fileHash: string | null;
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
  selectAndPrepareAudio(tradeId: string, proposalItemId: string): Promise<AudioPrepResult>;
}

/** Result of startup diff scan comparing SQLite index vs filesystem. */
export interface DiffScanResult {
  added: number;
  removed: number;
  modified: number;
  totalIndexed: number;
  hasChanges: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// LIBRARY — Phase 29+32: Local Index + AI Metadata Enrichment
// ─────────────────────────────────────────────────────────────────────────────

export type MetadataConfidence = "high" | "low" | "ai";

export interface ScanProgressEvent {
  filesFound: number;
  filesProcessed: number;
  currentPath: string;
  errorCount: number;
}

export interface ScanResult {
  filesFound: number;
  filesProcessed: number;
  errors: Array<{ filePath: string; reason: string }>;
}

export interface LibraryTrack {
  id: string;
  filePath: string;
  fileHash: string | null;
  fileSize: number;
  modifiedAt: string;
  scannedAt: string;
  artist: string | null;
  album: string | null;
  title: string | null;
  year: number | null;
  trackNumber: number | null;
  format: string;
  bitrate: number;
  sampleRate: number;
  bitDepth: number | null;
  duration: number;
  artistConfidence: MetadataConfidence;
  albumConfidence: MetadataConfidence;
  titleConfidence: MetadataConfidence;
  yearConfidence: MetadataConfidence;
  trackConfidence: MetadataConfidence;
  /** Phase 32: Per-field user edit flags */
  artistUserEdited: boolean;
  albumUserEdited: boolean;
  titleUserEdited: boolean;
  yearUserEdited: boolean;
  trackUserEdited: boolean;
}

export interface SyncResult {
  synced: number;
  created: number;
  linked: number;
  deleted: number;
  errors: string[];
}

export interface SyncProgress {
  phase: "preparing" | "uploading" | "deleting" | "done" | "error";
  total: number;
  sent: number;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIO — Phase 27: Desktop Audio Pipeline
// ─────────────────────────────────────────────────────────────────────────────

export interface AudioPrepResult {
  tradeId: string;
  proposalItemId: string;
  storagePath: string;
  signedUrl: string;
  expiresAt: string;
  sha256: string;
  format: string;
  bitrate: number;
  sampleRate: number;
  duration: number;
  fileSize: number;
}

export interface MultiItemProgressEvent {
  tradeId: string;
  itemIndex: number;
  totalItems: number;
  proposalItemId: string;
  bytesTransferred: number;
  totalBytes: number;
}

export interface MultiItemCompleteEvent {
  tradeId: string;
  completedItems: Array<{
    proposalItemId: string;
    filePath: string;
    sha256: string;
  }>;
  allVerified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// AI ENRICHMENT — Phase 32
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichProgressEvent {
  total: number;
  processed: number;
  enriched: number;
  errorCount: number;
}

export interface EnrichResult {
  total: number;
  enriched: number;
  errors: string[];
}

export interface DesktopBridgeLibrary {
  selectLibraryFolder(): Promise<string | null>;
  startScan(folderPath: string): Promise<ScanResult>;
  startIncrementalScan(): Promise<ScanResult>;
  startFullScan(): Promise<ScanResult>;
  startSync(): Promise<SyncResult>;
  getLibraryTracks(): Promise<LibraryTrack[]>;
  getLibraryRoot(): Promise<string | null>;
  onScanProgress(listener: (event: ScanProgressEvent) => void): () => void;
  onSyncProgress(listener: (event: SyncProgress) => void): () => void;
  /** Phase 32: AI enrichment */
  enrichMetadata(): Promise<EnrichResult>;
  updateTrackField(trackId: string, field: string, value: string | number | null): Promise<void>;
  getGeminiApiKey(): Promise<string | null>;
  setGeminiApiKey(apiKey: string): Promise<void>;
  removeGeminiApiKey(): Promise<void>;
  onEnrichProgress(listener: (event: EnrichProgressEvent) => void): () => void;
}

declare global {
  interface Window {
    desktopShell?: DesktopMainShellBridge;
    desktopBridge: DesktopBridge & DesktopBridgeTradeRuntime & DesktopBridgeLibrary;
  }
}

export {};
