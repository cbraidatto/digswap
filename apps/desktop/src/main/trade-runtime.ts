import fs from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  TRADE_STATUS,
  tradeRuntimePolicy,
  type IceCandidateType,
  type TradeStatus,
  type TradeTransferReceipt,
} from "@digswap/trade-domain";
import type {
  LobbyStateEvent,
  PendingTrade,
  TradeDetail,
  TradeLeg,
  TransferCompleteEvent,
  TransferProgressEvent,
} from "../shared/ipc-types";
import type { DesktopSupabaseConfig } from "./config";
import type { PendingTransferReceiptRecord, DesktopSessionStore } from "./session-store";
import type { DesktopSupabaseAuth } from "./supabase-auth";
import { receiveFile, sendFile } from "./webrtc/chunked-transfer";
import { PeerSession, type PeerRole } from "./webrtc/peer-session";
import { fetchTurnCredentials } from "./webrtc/turn-credentials";

interface PendingTradeRpcRow {
  trade_id: string;
  counterparty_username: string | null;
  counterparty_avatar_url: string | null;
  status: string | null;
  updated_at: string;
}

interface TradeRequestRow {
  id: string;
  requester_id: string;
  provider_id: string;
  release_id: string | null;
  offering_release_id: string | null;
  status: string | null;
  message: string | null;
  expires_at: string | null;
  file_name: string | null;
  file_format: string | null;
  declared_quality: string | null;
  condition_notes: string | null;
  file_size_bytes: number | null;
  file_hash: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  username: string | null;
  avatar_url: string | null;
}

interface ReleaseRow {
  title: string | null;
  artist: string | null;
  format: string | null;
}

interface LeaseRpcRow {
  last_ice_candidate_type: string | null;
}

interface TradeRuntimeSessionPeerRow {
  peer_id: string | null;
  user_id: string;
}

interface CachedTradeContext {
  counterpartyId: string;
  detail: TradeDetail;
  normalizedTransferBytes: number;
  receivedFileName: string;
  transferRole: PeerRole;
  /** SHA-256 hash declared by the sender at file offer time, stored in the DB.
   *  Used by the receiver to verify the downloaded file independently of
   *  any hash the sender may transmit over the data channel. */
  senderDeclaredHash: string | null;
}

interface ActiveLease {
  heartbeatTimer: ReturnType<typeof setInterval>;
  lastIceCandidateType: IceCandidateType | null;
  status: TradeStatus;
}

interface ActiveSessionRecord {
  partPath: string | null;
  realtimeChannel: RealtimeChannel | null;
  role: PeerRole;
  session: PeerSession;
}

type Listener<TPayload> = (payload: TPayload) => void;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const DEFAULT_TRANSFER_BYTES = 6 * 1024 * 1024;
const MIN_TRANSFER_BYTES = 512 * 1024;
const MAX_TRANSFER_BYTES = 8 * 1024 * 1024;
const PEER_ID_COORDINATION_TIMEOUT_MS = 15_000;

class UserCancelledPickerError extends Error {
  constructor() {
    super("File picker cancelled by user");
    this.name = "UserCancelledPickerError";
  }
}

export class DesktopTradeRuntime {
  private readonly deviceId: string;
  private readonly activeLeases = new Map<string, ActiveLease>();
  private readonly activeSessions = new Map<string, ActiveSessionRecord>();
  private readonly cachedTradeContexts = new Map<string, CachedTradeContext>();
  private readonly consumedHandoffTokens = new Set<string>();
  private readonly lobbyListeners = new Set<Listener<LobbyStateEvent>>();
  private readonly transferProgressListeners = new Set<Listener<TransferProgressEvent>>();
  private readonly transferCompleteListeners = new Set<Listener<TransferCompleteEvent>>();
  private readonly unsubscribeSessionListener: () => void;
  private reconcileInFlight = false;

  constructor(
    private readonly config: DesktopSupabaseConfig | null,
    private readonly authRuntime: DesktopSupabaseAuth,
    private readonly sessionStore: DesktopSessionStore,
  ) {
    this.deviceId = this.sessionStore.getOrCreateDeviceId();
    this.unsubscribeSessionListener = this.authRuntime.onSessionChanged((session) => {
      if (session) {
        void this.reconcilePendingTransferReceipts();
        return;
      }

      void this.cancelAllSessions();
      this.clearHeartbeatTimers();
    });
  }

  async initialize() {
    const session = await this.authRuntime.getSession();
    if (session) {
      await this.reconcilePendingTransferReceipts();
    }
  }

  async shutdown() {
    await this.cancelAllSessions();
    await this.releaseAllLeases();
    this.unsubscribeSessionListener();
    this.clearHeartbeatTimers();
  }

  onLobbyStateChanged(listener: Listener<LobbyStateEvent>) {
    this.lobbyListeners.add(listener);

    return () => {
      this.lobbyListeners.delete(listener);
    };
  }

  onTransferProgress(listener: Listener<TransferProgressEvent>) {
    this.transferProgressListeners.add(listener);

    return () => {
      this.transferProgressListeners.delete(listener);
    };
  }

  onTransferComplete(listener: Listener<TransferCompleteEvent>) {
    this.transferCompleteListeners.add(listener);

    return () => {
      this.transferCompleteListeners.delete(listener);
    };
  }

  async getPendingTrades() {
    const session = await this.authRuntime.getSession();
    if (!session) {
      return [] as PendingTrade[];
    }

    const client = this.authRuntime.getClientOrThrow();
    const { data, error } = await client.rpc("list_desktop_pending_trades");

    if (error) {
      throw new Error(`Failed to load pending trades: ${error.message}`);
    }

    const rows = (data ?? []) as PendingTradeRpcRow[];

    return rows.map((row) => ({
      tradeId: row.trade_id,
      counterpartyUsername: row.counterparty_username?.trim() || "Unknown digger",
      counterpartyAvatarUrl: row.counterparty_avatar_url,
      status: normalizeTradeStatus(row.status),
      updatedAt: row.updated_at,
      handoffToken: row.trade_id,
    }));
  }

  async openTradeFromHandoff(handoffToken: string) {
    const { tradeId, token } = this.resolveTradeTarget(handoffToken);
    const context = await this.loadTradeContext(tradeId, true);
    await this.prepareTradeAccess(context, token);
  }

  async getTradeDetail(tradeId: string): Promise<TradeDetail> {
    const context = await this.loadTradeContext(tradeId, true);
    await this.prepareTradeAccess(context);
    return context.detail;
  }

  async startTransfer(tradeId: string) {
    if (this.activeSessions.has(tradeId)) {
      return;
    }

    const context = await this.loadTradeContext(tradeId);
    await this.prepareTradeAccess(context);
    let sourceFilePath: string | null = null;

    try {
      if (context.transferRole === "sender") {
        sourceFilePath = await this.pickSourceFile(context);
        const sourceFileStats = await fs.stat(sourceFilePath);

        if (!sourceFileStats.isFile()) {
          throw new Error("Selected transfer source is not a file.");
        }

        if (sourceFileStats.size <= 0) {
          throw new Error("Selected transfer source file is empty.");
        }

        context.normalizedTransferBytes = sourceFileStats.size;
        context.receivedFileName = sanitizeFileName(path.basename(sourceFilePath));
      }

      const client = this.authRuntime.getClientOrThrow();
      const iceServers = await fetchTurnCredentials(client);
      const session = new PeerSession(tradeId, context.transferRole, iceServers, {
        onConnected: () => {
          this.emitTransferProgress({
            bytesReceived: 0,
            totalBytes: context.normalizedTransferBytes,
            peerConnected: true,
          });
        },
        onDisconnected: () => {
          this.emitTransferProgress({
            bytesReceived: 0,
            totalBytes: context.normalizedTransferBytes,
            peerConnected: false,
          });
        },
        onError: (error) => {
          console.error("[trade-runtime] peer session error", error);
        },
        onIceCandidate: (type) => {
          this.setLastIceCandidateType(tradeId, type);
        },
        onPeerIdRegistered: (peerId) => {
          void this.publishAndSubscribePeerId(tradeId, peerId, session);
        },
      });

      this.activeSessions.set(tradeId, {
        partPath: context.transferRole === "receiver" ? this.getPartPath(tradeId) : null,
        realtimeChannel: null,
        role: context.transferRole,
        session,
      });

      this.emitTransferProgress({
        bytesReceived: 0,
        totalBytes: context.normalizedTransferBytes,
        peerConnected: false,
      });

      if (context.transferRole === "sender") {
        void this.runSenderTransfer(tradeId, session, sourceFilePath);
        return;
      }

      void this.runReceiverTransfer(tradeId, context, session);
    } catch (error) {
      await this.releaseTradeLease(tradeId);
      throw error;
    }
  }

  async cancelTransfer(tradeId: string) {
    await this.cancelSession(tradeId);
    await this.releaseTradeLease(tradeId);
  }

  async confirmCompletion(tradeId: string, rating: number) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return;
    }

    const session = await this.authRuntime.getSession();
    if (!session) {
      return;
    }

    // `finalize_trade_transfer` already commits the receipt upsert, the
    // trade_runtime_sessions update, and the trade_requests status change as a
    // single Postgres RPC. By the time confirmCompletion() continues, transfer
    // completion has either fully committed or fully rolled back.
    await this.reconcilePendingTransferReceipts();

    const context = await this.loadTradeContext(tradeId);
    const client = this.authRuntime.getClientOrThrow();

    // The desktop rating is intentionally best-effort and outside the atomic
    // transfer RPC: a review failure must never partially undo trade
    // completion or leave the transfer receipt half-written.
    try {
      const { data: existingReview, error: reviewLookupError } = await client
        .from("trade_reviews")
        .select("id")
        .eq("trade_id", tradeId)
        .eq("reviewer_id", session.user.id)
        .maybeSingle();

      if (reviewLookupError) {
        throw reviewLookupError;
      }

      if (!existingReview) {
        const { error: insertError } = await client.from("trade_reviews").insert({
          trade_id: tradeId,
          reviewer_id: session.user.id,
          reviewed_id: context.counterpartyId,
          quality_rating: rating,
          comment: null,
        });

        if (insertError) {
          throw insertError;
        }
      }
    } catch (error) {
      console.error("[trade-runtime] failed to persist desktop review", error);
    }

    await this.releaseTradeLease(tradeId);
    this.cachedTradeContexts.delete(tradeId);
  }

  async openFileInExplorer(_filePath: string) {
    // Native shell integration stays in ipc.ts.
  }

  queueTransferReceipt(receipt: TradeTransferReceipt) {
    const queuedReceipt: PendingTransferReceiptRecord = {
      ...receipt,
      queuedAt: new Date().toISOString(),
      lastAttemptAt: null,
      lastError: null,
    };

    this.sessionStore.upsertPendingTransferReceipt(queuedReceipt);
    void this.reconcilePendingTransferReceipts();
  }

  emitTransferProgress(event: TransferProgressEvent) {
    for (const listener of this.transferProgressListeners) {
      listener(event);
    }
  }

  emitTransferComplete(event: TransferCompleteEvent) {
    for (const listener of this.transferCompleteListeners) {
      listener(event);
    }
  }

  setLastIceCandidateType(tradeId: string, iceCandidateType: IceCandidateType) {
    const activeLease = this.activeLeases.get(tradeId);
    if (!activeLease) {
      return;
    }

    activeLease.lastIceCandidateType = iceCandidateType;
  }

  async releaseAllLeases() {
    const activeTradeIds = [...this.activeLeases.keys()];

    for (const tradeId of activeTradeIds) {
      await this.releaseTradeLease(tradeId);
    }
  }

  private async prepareTradeAccess(context: CachedTradeContext, explicitToken?: string | null) {
    const token = explicitToken ?? this.getStoredHandoffToken(context.detail.tradeId);

    if (token && !this.consumedHandoffTokens.has(token)) {
      await this.consumeHandoffToken(context.detail.tradeId, token);
      this.consumedHandoffTokens.add(token);
    }

    if (isTerminalTradeStatus(context.detail.status)) {
      this.emitLobbyState({
        status: context.detail.status,
        bothOnline: false,
        leaseHolder: null,
      });
      return;
    }

    await this.ensureTradeLease(context.detail.tradeId, context.detail.status);
  }

  private async loadTradeContext(tradeId: string, forceRefresh = false) {
    if (!forceRefresh) {
      const cachedContext = this.cachedTradeContexts.get(tradeId);
      if (cachedContext) {
        return cachedContext;
      }
    }

    const session = await this.authRuntime.getSession();
    if (!session) {
      throw new Error("Sign in to DigSwap Desktop before opening a trade.");
    }

    const client = this.authRuntime.getClientOrThrow();
    const { data: tradeData, error: tradeError } = await client
      .from("trade_requests")
      .select(
        "id, requester_id, provider_id, release_id, offering_release_id, status, message, expires_at, file_name, file_format, declared_quality, condition_notes, file_size_bytes, file_hash, created_at, updated_at",
      )
      .eq("id", tradeId)
      .single();

    if (tradeError || !tradeData) {
      throw new Error(tradeError?.message ?? "Trade not found.");
    }

    const trade = tradeData as TradeRequestRow;
    const isRequester = trade.requester_id === session.user.id;
    const isProvider = trade.provider_id === session.user.id;

    if (!isRequester && !isProvider) {
      throw new Error("You are not a participant in this trade.");
    }

    const counterpartyId = isRequester ? trade.provider_id : trade.requester_id;

    const [counterpartyProfile, requestedRelease, offeringRelease] = await Promise.all([
      this.fetchProfile(counterpartyId),
      this.fetchRelease(trade.release_id),
      this.fetchRelease(trade.offering_release_id),
    ]);

    const providerLeg = buildTradeLeg({
      fallbackTitle: trade.file_name ?? "Requested release",
      release: requestedRelease,
      trade,
      attachTransferMetadata: true,
    });
    const requesterLeg = buildTradeLeg({
      fallbackTitle: offeringRelease?.title ?? "Offer pending",
      release: offeringRelease,
      trade,
      attachTransferMetadata: false,
    });

    const myLeg = isRequester ? requesterLeg : providerLeg;
    const counterpartyLeg = isRequester ? providerLeg : requesterLeg;

    const detail: TradeDetail = {
      tradeId,
      status: normalizeTradeStatus(trade.status),
      myLeg,
      counterpartyLeg,
      counterpartyUsername: counterpartyProfile?.username?.trim() || "Unknown digger",
      counterpartyAvatarUrl: counterpartyProfile?.avatar_url ?? null,
      createdAt: trade.created_at,
      expiresAt: trade.expires_at,
    };

    const context: CachedTradeContext = {
      counterpartyId,
      detail,
      normalizedTransferBytes: normalizeTransferBytes(providerLeg.fileSizeBytes),
      receivedFileName: sanitizeFileName(
        providerLeg.fileNameHint ?? trade.file_name ?? `${providerLeg.title || "trade"}.bin`,
      ),
      transferRole: isProvider ? "sender" : "receiver",
      senderDeclaredHash: trade.file_hash ?? null,
    };

    this.cachedTradeContexts.set(tradeId, context);
    return context;
  }

  private async fetchProfile(profileId: string) {
    const client = this.authRuntime.getClientOrThrow();
    const { data, error } = await client
      .from("profiles")
      .select("username, avatar_url")
      .eq("id", profileId)
      .maybeSingle();

    if (error) {
      console.error("[trade-runtime] failed to load profile", error);
      return null;
    }

    return (data as ProfileRow | null) ?? null;
  }

  private async fetchRelease(releaseId: string | null) {
    if (!releaseId) {
      return null;
    }

    const client = this.authRuntime.getClientOrThrow();
    const { data, error } = await client
      .from("releases")
      .select("title, artist, format")
      .eq("id", releaseId)
      .maybeSingle();

    if (error) {
      console.error("[trade-runtime] failed to load release", error);
      return null;
    }

    return (data as ReleaseRow | null) ?? null;
  }

  private resolveTradeTarget(handoffToken: string) {
    if (UUID_PATTERN.test(handoffToken)) {
      return {
        tradeId: handoffToken,
        token: null,
      };
    }

    const protocolPayload = this.sessionStore.getLastProtocolPayload();
    if (
      protocolPayload?.kind === "trade-handoff" &&
      (protocolPayload.token === handoffToken || protocolPayload.handoffToken === handoffToken)
    ) {
      return {
        tradeId: protocolPayload.tradeId,
        token: protocolPayload.token,
      };
    }

    throw new Error("Unknown handoff token. Open the trade again from the DigSwap web handoff page.");
  }

  private getStoredHandoffToken(tradeId: string) {
    const protocolPayload = this.sessionStore.getLastProtocolPayload();
    if (protocolPayload?.kind !== "trade-handoff" || protocolPayload.tradeId !== tradeId) {
      return null;
    }

    return protocolPayload.token ?? protocolPayload.handoffToken ?? null;
  }

  private async consumeHandoffToken(tradeId: string, token: string) {
    if (!this.config) {
      throw new Error(this.authRuntime.getConfigError() ?? "Desktop runtime is not configured.");
    }

    const accessToken = await this.authRuntime.getAccessToken();
    if (!accessToken) {
      throw new Error("Sign in to DigSwap Desktop before opening a handoff from the web app.");
    }

    const response = await fetch(`${this.config.siteUrl}/api/desktop/handoff/consume`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tradeId,
        token,
      }),
    });

    if (response.ok) {
      return;
    }

    let message = "Failed to consume the DigSwap handoff token.";

    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        message = body.error;
      }
    } catch {
      // Ignore JSON parsing failures and keep the generic message.
    }

    throw new Error(message);
  }

  private async ensureTradeLease(tradeId: string, status: TradeStatus) {
    await this.releaseOtherLeases(tradeId);

    const client = this.authRuntime.getClientOrThrow();
    const { data, error } = await client.rpc("acquire_trade_lease", {
      p_trade_id: tradeId,
      p_device_id: this.deviceId,
      p_client_kind: "desktop",
      p_desktop_version: this.config?.desktopVersionCode ?? 1,
      p_trade_protocol_version: tradeRuntimePolicy.tradeProtocolVersion,
    });

    if (error) {
      throw new Error(`Failed to acquire the DigSwap trade lease: ${error.message}`);
    }

    const rows = (data ?? []) as LeaseRpcRow[];
    const activeLeaseRow = rows[0];

    this.startHeartbeatLoop(
      tradeId,
      status,
      normalizeIceCandidateType(activeLeaseRow?.last_ice_candidate_type) ?? "host",
    );

    this.emitLobbyState({
      status,
      bothOnline: true,
      leaseHolder: "me",
    });
  }

  private async releaseTradeLease(tradeId: string) {
    const activeLease = this.activeLeases.get(tradeId);
    if (!activeLease) {
      return;
    }

    clearInterval(activeLease.heartbeatTimer);
    this.activeLeases.delete(tradeId);

    try {
      const session = await this.authRuntime.getSession();
      if (!session) {
        return;
      }

      const client = this.authRuntime.getClientOrThrow();
      const { error } = await client.rpc("release_trade_lease", {
        p_trade_id: tradeId,
        p_device_id: this.deviceId,
      });

      if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      console.error("[trade-runtime] failed to release trade lease", error);
    } finally {
      this.emitLobbyState({
        status: activeLease.status,
        bothOnline: false,
        leaseHolder: null,
      });
    }
  }

  private async releaseOtherLeases(tradeIdToKeep: string) {
    const otherTradeIds = [...this.activeLeases.keys()].filter(
      (tradeId) => tradeId !== tradeIdToKeep,
    );

    for (const tradeId of otherTradeIds) {
      await this.releaseTradeLease(tradeId);
    }
  }

  private startHeartbeatLoop(
    tradeId: string,
    status: TradeStatus,
    lastIceCandidateType: IceCandidateType | null,
  ) {
    const existingLease = this.activeLeases.get(tradeId);
    if (existingLease) {
      clearInterval(existingLease.heartbeatTimer);
    }

    const heartbeatTimer = setInterval(() => {
      void this.sendLeaseHeartbeat(tradeId);
    }, tradeRuntimePolicy.leaseHeartbeatIntervalMs);

    this.activeLeases.set(tradeId, {
      heartbeatTimer,
      lastIceCandidateType,
      status,
    });
  }

  private async sendLeaseHeartbeat(tradeId: string) {
    const activeLease = this.activeLeases.get(tradeId);
    if (!activeLease) {
      return;
    }

    const client = this.authRuntime.getClientOrThrow();
    const { error } = await client.rpc("heartbeat_trade_lease", {
      p_trade_id: tradeId,
      p_device_id: this.deviceId,
      p_desktop_version: this.config?.desktopVersionCode ?? 1,
      p_trade_protocol_version: tradeRuntimePolicy.tradeProtocolVersion,
      p_last_ice_candidate_type: activeLease.lastIceCandidateType,
    });

    if (!error) {
      return;
    }

    clearInterval(activeLease.heartbeatTimer);
    this.activeLeases.delete(tradeId);

    this.emitLobbyState({
      status: activeLease.status,
      bothOnline: false,
      leaseHolder: null,
    });
  }

  private async runSenderTransfer(
    tradeId: string,
    session: PeerSession,
    sourceFilePath: string | null,
  ) {
    let completion: TransferCompleteEvent | null = null;

    try {
      if (!sourceFilePath) {
        throw new Error("Sender transfer started without a selected source file.");
      }

      // Race B: if the sender connects while expectedRemotePeerId is still the
      // legacy placeholder (`${tradeId}-r` / `${tradeId}-s`), wireConnection()
      // rejects the socket as an unexpected peer. Wait until the coordination
      // channel replaces the placeholder with the real randomized peer ID.
      await session.waitForExpectedPeerIdUpdate(PEER_ID_COORDINATION_TIMEOUT_MS);
      const connection = await session.connect();

      await sendFile(connection, sourceFilePath, {
        onProgress: (bytesTransferred, totalBytes) => {
          this.emitTransferProgress({
            bytesReceived: bytesTransferred,
            totalBytes,
            peerConnected: true,
          });
        },
        onComplete: (filePath, sha256) => {
          completion = {
            filePath,
            sha256,
            tradeId,
          };
        },
        onError: (error) => {
          console.error("[trade-runtime] sender transfer failed", error);
        },
      });

      if (completion) {
        this.markTradeComplete(tradeId);
        this.emitTransferComplete(completion);
      }
    } catch (error) {
      console.error("[trade-runtime] sender session failed", error);
    } finally {
      await this.finishSession(tradeId);
    }
  }

  private async runReceiverTransfer(
    tradeId: string,
    context: CachedTradeContext,
    session: PeerSession,
  ) {
    const { finalPath, partPath } = await this.getReceivePaths(tradeId, context);
    const activeSession = this.activeSessions.get(tradeId);
    if (activeSession) {
      activeSession.partPath = partPath;
    }

    let completion: TransferCompleteEvent | null = null;

    try {
      const connection = await session.waitForConnection();

      // Use the file hash stored in the DB when the sender declared the file —
      // never trust the hash that comes from the sender over the data channel.
      const declaredHash = context.senderDeclaredHash ?? null;
      await receiveFile(connection, partPath, finalPath, declaredHash, {
        onProgress: (bytesTransferred, totalBytes) => {
          this.emitTransferProgress({
            bytesReceived: bytesTransferred,
            totalBytes,
            peerConnected: true,
          });
        },
        onComplete: (filePath, sha256) => {
          completion = {
            filePath,
            sha256,
            tradeId,
          };
        },
        onError: (error) => {
          console.error("[trade-runtime] receiver transfer failed", error);
        },
      });

      if (completion) {
        await this.handleReceiverCompletion(tradeId, completion);
      }
    } catch (error) {
      console.error("[trade-runtime] receiver session failed", error);
      await safeDeleteFile(partPath);
    } finally {
      await this.finishSession(tradeId);
    }
  }

  private async handleReceiverCompletion(tradeId: string, completion: TransferCompleteEvent) {
    const fileStats = await fs.stat(completion.filePath);
    const iceCandidateType = this.activeLeases.get(tradeId)?.lastIceCandidateType ?? "host";

    this.queueTransferReceipt({
      tradeId,
      deviceId: this.deviceId,
      fileName: path.basename(completion.filePath),
      fileSizeBytes: fileStats.size,
      fileHashSha256: completion.sha256,
      completedAt: new Date().toISOString(),
      iceCandidateType,
      tradeProtocolVersion: tradeRuntimePolicy.tradeProtocolVersion,
    });

    await this.reconcilePendingTransferReceipts();
    this.markTradeComplete(tradeId);
    this.emitTransferComplete(completion);
  }

  private markTradeComplete(tradeId: string) {
    const activeLease = this.activeLeases.get(tradeId);
    if (activeLease) {
      activeLease.status = TRADE_STATUS.COMPLETED;
    }

    const cachedContext = this.cachedTradeContexts.get(tradeId);
    if (cachedContext) {
      cachedContext.detail.status = TRADE_STATUS.COMPLETED;
    }
  }

  private async pickSourceFile(context: CachedTradeContext) {
    const defaultPath =
      this.sessionStore.getLastSourceDirectory() ?? this.sessionStore.getSettings().downloadPath;

    const result = await dialog.showOpenDialog({
      buttonLabel: "Use This File",
      defaultPath,
      filters: [
        {
          extensions: ["wav", "flac", "aif", "aiff", "mp3", "m4a", "ogg", "opus"],
          name: "Audio Files",
        },
        {
          extensions: ["*"],
          name: "All Files",
        },
      ],
      properties: ["openFile"],
      title: `Choose the file to send to ${context.detail.counterpartyUsername}`,
    });

    const selectedFilePath = result.filePaths[0] ?? null;
    if (result.canceled || !selectedFilePath) {
      throw new UserCancelledPickerError();
    }

    this.sessionStore.setLastSourceDirectory(path.dirname(selectedFilePath));
    return selectedFilePath;
  }

  private async getReceivePaths(tradeId: string, context: CachedTradeContext) {
    const downloadPath = this.sessionStore.getSettings().downloadPath;
    const partPath = this.getPartPath(tradeId);
    const finalDirectory = path.join(
      downloadPath,
      sanitizePathSegment(context.detail.counterpartyUsername),
    );

    await fs.mkdir(finalDirectory, { recursive: true });

    const desiredFinalPath = path.join(
      finalDirectory,
      `${tradeId}_${context.receivedFileName}`,
    );

    const finalPath = await resolveUniqueFilePath(desiredFinalPath);
    return {
      finalPath,
      partPath,
    };
  }

  private getPartPath(tradeId: string) {
    return path.join(this.sessionStore.getSettings().downloadPath, `${tradeId}.part`);
  }

  private async finishSession(tradeId: string) {
    const activeSession = this.activeSessions.get(tradeId);
    if (!activeSession) {
      return;
    }

    if (activeSession.realtimeChannel) {
      await activeSession.realtimeChannel.unsubscribe();
    }

    await activeSession.session.destroy();
    this.activeSessions.delete(tradeId);
  }

  private async reconcilePendingTransferReceipts() {
    if (this.reconcileInFlight) {
      return;
    }

    const session = await this.authRuntime.getSession();
    if (!session) {
      return;
    }

    this.reconcileInFlight = true;

    try {
      const client = this.authRuntime.getClientOrThrow();
      const receipts = this.sessionStore.getPendingTransferReceipts();

      for (const receipt of receipts) {
        const attemptAt = new Date().toISOString();

        try {
          // This RPC is the atomic boundary for transfer completion. The
          // PL/pgSQL function performs the receipt upsert plus the related
          // session/trade updates inside one database statement, so the desktop
          // runtime should retry the whole RPC instead of splitting it into
          // separate client-side mutations.
          const { error } = await client.rpc("finalize_trade_transfer", {
            p_trade_id: receipt.tradeId,
            p_device_id: receipt.deviceId,
            p_file_name: receipt.fileName,
            p_file_size_bytes: receipt.fileSizeBytes,
            p_file_hash_sha256: receipt.fileHashSha256,
            p_completed_at: receipt.completedAt,
            p_ice_candidate_type: receipt.iceCandidateType,
            p_trade_protocol_version: receipt.tradeProtocolVersion,
          });

          if (error) {
            throw new Error(error.message);
          }

          this.sessionStore.removePendingTransferReceipt(
            receipt.tradeId,
            receipt.deviceId,
            receipt.fileHashSha256,
          );
        } catch (error) {
          this.sessionStore.upsertPendingTransferReceipt({
            ...receipt,
            lastAttemptAt: attemptAt,
            lastError: error instanceof Error ? error.message : "Unknown reconciliation failure",
          });
        }
      }
    } finally {
      this.reconcileInFlight = false;
    }
  }

  /**
   * Called when PeerJS confirms our peer ID registration.
   *
   * 1. Publishes the peer ID to the DB via the `update_trade_peer_id` RPC so
   *    the counterparty can read it via Realtime postgres_changes.
   * 2. Subscribes to `trade_runtime_sessions` changes for this trade so we
   *    receive the counterparty's peer ID and can validate their connection.
   */
  private async publishAndSubscribePeerId(
    tradeId: string,
    peerId: string,
    session: PeerSession,
  ) {
    let channel: RealtimeChannel | null = null;

    try {
      const supabaseSession = await this.authRuntime.getSession();
      if (!supabaseSession) {
        return;
      }

      const client = this.authRuntime.getClientOrThrow();
      const userId = supabaseSession.user.id;

      // Race A: subscribing after we publish leaves a gap where the
      // counterparty's UPDATE can land before our listener is active. The fix
      // is "snapshot + listen": start the Realtime listener first, wait for the
      // SUBSCRIBED ack, read the current counterparty peer_id directly from
      // trade_runtime_sessions, then keep listening for future UPDATE events.
      channel = client
        .channel(`trade-peers:${tradeId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "trade_runtime_sessions",
            filter: `trade_id=eq.${tradeId}`,
          },
          (payload: { new: Record<string, unknown> }) => {
            const row = payload.new;
            if (
              typeof row["user_id"] === "string" &&
              typeof row["peer_id"] === "string" &&
              row["user_id"] !== userId &&
              row["peer_id"]
            ) {
              session.updateExpectedRemotePeerId(row["peer_id"] as string);
            }
          },
        );

      // Store the channel reference so it can be cleaned up on session end.
      const activeSession = this.activeSessions.get(tradeId);
      if (activeSession) {
        activeSession.realtimeChannel = channel;
      }

      await this.waitForRealtimeSubscription(channel, tradeId);

      const { data: snapshotRow, error: snapshotError } = await client
        .from("trade_runtime_sessions")
        .select("user_id, peer_id")
        .eq("trade_id", tradeId)
        .neq("user_id", userId)
        .is("released_at", null)
        .not("peer_id", "is", null)
        .maybeSingle();

      if (snapshotError) {
        throw new Error(`Failed to snapshot counterparty peer ID: ${snapshotError.message}`);
      }

      const counterpartyPeerId = (snapshotRow as TradeRuntimeSessionPeerRow | null)?.peer_id ?? null;
      if (counterpartyPeerId) {
        session.updateExpectedRemotePeerId(counterpartyPeerId);
      }

      const { error: rpcError } = await client.rpc("update_trade_peer_id", {
        p_trade_id: tradeId,
        p_device_id: this.deviceId,
        p_peer_id: peerId,
      });

      if (rpcError) {
        console.error("[trade-runtime] failed to publish peer ID", rpcError.message);
      }
    } catch (error) {
      if (channel) {
        await channel.unsubscribe().catch(() => undefined);
      }

      const activeSession = this.activeSessions.get(tradeId);
      if (activeSession?.realtimeChannel === channel) {
        activeSession.realtimeChannel = null;
      }

      console.error("[trade-runtime] error in publishAndSubscribePeerId", error);
    }
  }

  private async waitForRealtimeSubscription(channel: RealtimeChannel, tradeId: string) {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Timed out subscribing to the peer ID channel for trade ${tradeId}.`),
        );
      }, PEER_ID_COORDINATION_TIMEOUT_MS);

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeoutId);
          console.log("[trade-runtime] subscribed to peer ID channel for trade", tradeId);
          resolve();
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "CLOSED" || status === "TIMED_OUT") {
          clearTimeout(timeoutId);
          reject(
            new Error(`Peer ID channel subscription failed with status ${status}.`),
          );
        }
      });
    });
  }

  private async cancelSession(tradeId: string) {
    const activeSession = this.activeSessions.get(tradeId);
    if (!activeSession) {
      return;
    }

    if (activeSession.realtimeChannel) {
      await activeSession.realtimeChannel.unsubscribe();
    }

    await activeSession.session.destroy();
    if (activeSession.partPath) {
      await safeDeleteFile(activeSession.partPath);
    }
    this.activeSessions.delete(tradeId);
  }

  private async cancelAllSessions() {
    const activeTradeIds = [...this.activeSessions.keys()];

    for (const tradeId of activeTradeIds) {
      await this.cancelSession(tradeId);
    }
  }

  private clearHeartbeatTimers() {
    for (const activeLease of this.activeLeases.values()) {
      clearInterval(activeLease.heartbeatTimer);
    }

    this.activeLeases.clear();
  }

  private emitLobbyState(event: LobbyStateEvent) {
    for (const listener of this.lobbyListeners) {
      listener(event);
    }
  }
}

function buildTradeLeg({
  fallbackTitle,
  release,
  trade,
  attachTransferMetadata,
}: {
  fallbackTitle: string;
  release: ReleaseRow | null;
  trade: TradeRequestRow;
  attachTransferMetadata: boolean;
}) {
  const fileNameHint = attachTransferMetadata ? trade.file_name : null;
  const fileSizeBytes = attachTransferMetadata ? trade.file_size_bytes : null;
  const fileHash = attachTransferMetadata ? (trade.file_hash ?? null) : null;

  return {
    title: release?.title?.trim() || fallbackTitle,
    artist: release?.artist?.trim() || "Unknown artist",
    format: release?.format?.trim() || trade.file_format?.trim() || "Vinyl rip",
    quality: trade.declared_quality?.trim() || "Unrated",
    notes: trade.condition_notes ?? trade.message,
    fileNameHint,
    fileSizeBytes,
    fileHash,
  } satisfies TradeLeg;
}

function normalizeTradeStatus(status: string | null | undefined): TradeStatus {
  switch (status) {
    case TRADE_STATUS.PENDING:
    case TRADE_STATUS.LOBBY:
    case TRADE_STATUS.PREVIEWING:
    case TRADE_STATUS.ACCEPTED:
    case TRADE_STATUS.TRANSFERRING:
    case TRADE_STATUS.COMPLETED:
    case TRADE_STATUS.DECLINED:
    case TRADE_STATUS.CANCELLED:
    case TRADE_STATUS.EXPIRED:
      return status;
    default:
      return TRADE_STATUS.PENDING;
  }
}

function normalizeIceCandidateType(value: string | null | undefined): IceCandidateType | null {
  if (value === "host" || value === "srflx" || value === "relay") {
    return value;
  }

  return null;
}

function normalizeTransferBytes(value: number | null | undefined) {
  if (!value || value <= 0) {
    return DEFAULT_TRANSFER_BYTES;
  }

  return Math.max(MIN_TRANSFER_BYTES, Math.min(MAX_TRANSFER_BYTES, value));
}

function isTerminalTradeStatus(status: TradeStatus) {
  return (
    status === TRADE_STATUS.COMPLETED ||
    status === TRADE_STATUS.DECLINED ||
    status === TRADE_STATUS.CANCELLED ||
    status === TRADE_STATUS.EXPIRED
  );
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").trim();
  return sanitized.length > 0 ? sanitized : "digswap-transfer.bin";
}

function sanitizePathSegment(value: string) {
  const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001f]/gu, "-").trim();
  return sanitized.length > 0 ? sanitized : "Unknown";
}

async function resolveUniqueFilePath(targetPath: string) {
  const parsed = path.parse(targetPath);
  let candidate = targetPath;
  let attempt = 2;

  while (await pathExists(candidate)) {
    candidate = path.join(parsed.dir, `${parsed.name} (${attempt})${parsed.ext}`);
    attempt += 1;
  }

  return candidate;
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function safeDeleteFile(targetPath: string) {
  try {
    await fs.unlink(targetPath);
  } catch (error) {
    const normalizedError = error as NodeJS.ErrnoException;
    if (normalizedError.code !== "ENOENT") {
      throw error;
    }
  }
}
