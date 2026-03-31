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
  TransferCompleteEvent,
  TransferProgressEvent,
} from "../shared/ipc-types";
import type { DesktopSupabaseConfig } from "./config";
import type { PendingTransferReceiptRecord, DesktopSessionStore } from "./session-store";
import type { DesktopSupabaseAuth } from "./supabase-auth";

interface PendingTradeRpcRow {
  trade_id: string;
  counterparty_username: string | null;
  counterparty_avatar_url: string | null;
  status: string | null;
  updated_at: string;
}

interface LeaseRpcRow {
  trade_id: string;
  last_ice_candidate_type: string | null;
}

interface ActiveLease {
  heartbeatTimer: ReturnType<typeof setInterval>;
  lastIceCandidateType: IceCandidateType | null;
  status: TradeStatus;
}

type Listener<TPayload> = (payload: TPayload) => void;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export class DesktopTradeRuntime {
  private readonly deviceId: string;
  private readonly activeLeases = new Map<string, ActiveLease>();
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
      return [] satisfies PendingTrade[];
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
      // Compatibility shim for the current renderer contract. Inbox-originated opens
      // already know the trade id, so we tunnel it through this field until 17-06.
      handoffToken: row.trade_id,
    }));
  }

  async openTradeFromHandoff(handoffToken: string) {
    const { tradeId, token } = this.resolveTradeTarget(handoffToken);

    if (token) {
      await this.consumeHandoffToken(tradeId, token);
    }

    const pendingTrade = await this.findPendingTrade(tradeId);
    await this.ensureTradeLease(tradeId, pendingTrade?.status ?? TRADE_STATUS.LOBBY);
  }

  async getTradeDetail(tradeId: string): Promise<TradeDetail> {
    const pendingTrade = await this.findPendingTrade(tradeId);
    const status = pendingTrade?.status ?? TRADE_STATUS.LOBBY;

    await this.ensureTradeLease(tradeId, status);

    return {
      tradeId,
      status,
      myLeg: {
        title: "Trade runtime active",
        artist: "DigSwap Desktop",
        format: "Negotiation details hydrate in 17-06",
        quality: "Pending",
        notes:
          "Lease, heartbeat, and receipt reconciliation are live. Full proposal hydration lands in 17-06.",
        fileNameHint: null,
        fileSizeBytes: null,
      },
      counterpartyLeg: {
        title: pendingTrade
          ? `Trade with ${pendingTrade.counterpartyUsername}`
          : "Counterparty details pending",
        artist: pendingTrade?.counterpartyUsername ?? "Unknown digger",
        format: "Awaiting runtime hydration",
        quality: "Pending",
        notes:
          "This placeholder keeps the integrated renderer stable while the lobby/transfer runtime is finalized.",
        fileNameHint: null,
        fileSizeBytes: null,
      },
      counterpartyUsername: pendingTrade?.counterpartyUsername ?? "Unknown digger",
      counterpartyAvatarUrl: pendingTrade?.counterpartyAvatarUrl ?? null,
      createdAt: pendingTrade?.updatedAt ?? new Date().toISOString(),
      expiresAt: null,
    };
  }

  async startTransfer(_tradeId: string) {
    throw new Error("Transfer orchestration lands in 17-06 once the runtime path is integrated.");
  }

  async cancelTransfer(tradeId: string) {
    await this.releaseTradeLease(tradeId);
  }

  async confirmCompletion(_tradeId: string, _rating: number) {
    // Rating persistence still lives in the web-side trade actions. Keep this
    // as a no-op for the runtime shell until 17-06 wires the completion flow.
  }

  async openFileInExplorer(_filePath: string) {
    throw new Error("Received-file explorer integration lands in 17-06.");
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

  private async findPendingTrade(tradeId: string) {
    const pendingTrades = await this.getPendingTrades();
    return pendingTrades.find((trade) => trade.tradeId === tradeId) ?? null;
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
      protocolPayload.handoffToken === handoffToken
    ) {
      return {
        tradeId: protocolPayload.tradeId,
        token: protocolPayload.handoffToken,
      };
    }

    throw new Error("Unknown handoff token. Open the trade again from the DigSwap web handoff page.");
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

    this.startHeartbeatLoop(tradeId, status, normalizeIceCandidateType(activeLeaseRow?.last_ice_candidate_type));
    this.emitLobbyState({
      status,
      bothOnline: false,
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
