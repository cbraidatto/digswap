import { randomBytes, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { utilityProcess, type UtilityProcess } from "electron";

export type PeerRole = "sender" | "receiver";

export interface PeerSessionCallbacks {
  onConnected(): void;
  onDisconnected(): void;
  onError(err: Error): void;
  onIceCandidate(type: "host" | "srflx" | "relay"): void;
  /** Called once the PeerJS server confirms our peer ID registration. */
  onPeerIdRegistered?(peerId: string): void;
}

type PendingResolver<TResult = unknown> = {
  reject: (error: Error) => void;
  resolve: (result: TResult) => void;
};

interface PeerBridgeEvent {
  error?: string;
  peerId?: string;
  payload?: unknown;
  requestId?: string;
  type:
    | "command-response"
    | "connected"
    | "data-buffer"
    | "data-json"
    | "disconnected"
    | "error"
    | "ice-candidate"
    | "peer-open";
}

interface PeerCommandMessage {
  kind?: "buffer" | "json";
  payload?: unknown;
  requestId: string;
  type: "close-connection" | "connect" | "destroy" | "send" | "update-expected-peer";
}

type BridgeEventHandler = (event: PeerBridgeEvent) => void;

export interface PeerTransportConnection {
  readonly remotePeerId: string;
  close(): Promise<void>;
  off(event: "close" | "data" | "error", listener: (...args: unknown[]) => void): this;
  on(event: "close" | "data" | "error", listener: (...args: unknown[]) => void): this;
  once(event: "close" | "data" | "error", listener: (...args: unknown[]) => void): this;
  send(payload: ArrayBuffer | Buffer | Uint8Array | Record<string, unknown>): Promise<void>;
}

class PeerConnectionBridge extends EventEmitter implements PeerTransportConnection {
  constructor(
    private readonly session: PeerSession,
    public readonly remotePeerId: string,
  ) {
    super();
  }

  async send(payload: ArrayBuffer | Buffer | Uint8Array | Record<string, unknown>) {
    await this.session.sendPayload(payload);
  }

  async close() {
    await this.session.closeConnection();
  }
}

export class PeerSession {
  private readonly peerId: string;
  private readonly placeholderRemotePeerId: string;
  private expectedRemotePeerId: string;
  private readonly pendingCommands = new Map<string, PendingResolver>();
  private readonly eventHandler: BridgeEventHandler;
  private bridgeProcess: UtilityProcess | null = null;
  private connection: PeerConnectionBridge | null = null;
  private expectedPeerIdIsPlaceholder = true;
  private isReady = false;
  private readyPromise: Promise<void>;
  private rejectReady: ((error: Error) => void) | null = null;
  private resolveReady: (() => void) | null = null;
  private waiters = new Set<PendingResolver<PeerTransportConnection>>();
  private expectedPeerIdWaiters = new Set<PendingResolver<string>>();

  constructor(
    private readonly tradeId: string,
    private readonly role: PeerRole,
    private readonly iceServers: RTCIceServer[],
    private readonly callbacks: PeerSessionCallbacks,
  ) {
    // Include a per-session random token in the peer ID so that an attacker
    // who knows the tradeId cannot squat the peer ID before the legitimate
    // participant registers with PeerJS. The remote peer ID is exchanged
    // out-of-band via Supabase Realtime (trade_runtime_sessions table).
    const sessionToken = randomBytes(8).toString("hex");
    this.peerId = role === "sender"
      ? `${tradeId}-${sessionToken}-s`
      : `${tradeId}-${sessionToken}-r`;
    // Seed expectedRemotePeerId with the old predictable format as a safe
    // placeholder. The real unpredictable peer ID is exchanged out-of-band via
    // Supabase Realtime (trade_runtime_sessions) and overwrites this value
    // via updateExpectedRemotePeerId() before the remote peer connects.
    this.placeholderRemotePeerId = role === "sender" ? `${tradeId}-r` : `${tradeId}-s`;
    this.expectedRemotePeerId = this.placeholderRemotePeerId;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.resolveReady = resolve;
    });
    this.eventHandler = (event) => {
      this.handleEvent(event);
    };

    void this.initialize();
  }

  async connect(): Promise<PeerTransportConnection> {
    await this.ensureReady();
    await this.invokeCommand({
      requestId: randomUUID(),
      type: "connect",
    });

    return this.waitForConnection();
  }

  async waitForConnection(timeoutMs = 30_000): Promise<PeerTransportConnection> {
    await this.ensureReady();

    if (this.connection) {
      return this.connection;
    }

    return new Promise<PeerTransportConnection>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waiters.delete(waiter);
        reject(new Error("Timed out waiting for the DigSwap peer session."));
      }, timeoutMs);

      const waiter: PendingResolver<PeerTransportConnection> = {
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        resolve: (connection) => {
          clearTimeout(timeoutId);
          resolve(connection);
        },
      };

      this.waiters.add(waiter);
    });
  }

  async waitForExpectedPeerIdUpdate(timeoutMs = 30_000): Promise<string> {
    await this.ensureReady();

    if (!this.expectedPeerIdIsPlaceholder) {
      return this.expectedRemotePeerId;
    }

    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.expectedPeerIdWaiters.delete(waiter);
        reject(
          new Error("Timed out waiting for the DigSwap counterparty peer ID."),
        );
      }, timeoutMs);

      const waiter: PendingResolver<string> = {
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        resolve: (peerId) => {
          clearTimeout(timeoutId);
          resolve(peerId);
        },
      };

      this.expectedPeerIdWaiters.add(waiter);
    });
  }

  /**
   * Update the expected remote peer ID after receiving it via the
   * Supabase Realtime coordination channel. Must be called before the
   * remote peer connects to ensure the identity check in `wireConnection`
   * accepts the correct (unpredictable, squat-resistant) peer ID.
   */
  updateExpectedRemotePeerId(peerId: string) {
    if (!peerId) {
      return;
    }

    this.expectedRemotePeerId = peerId;
    const isPlaceholder = peerId === this.placeholderRemotePeerId;
    const resolvedPlaceholder = this.expectedPeerIdIsPlaceholder && !isPlaceholder;
    this.expectedPeerIdIsPlaceholder = isPlaceholder;

    if (resolvedPlaceholder) {
      for (const waiter of this.expectedPeerIdWaiters) {
        waiter.resolve(peerId);
      }
      this.expectedPeerIdWaiters.clear();
    }

    // Also propagate to the bridge worker running in the utilityProcess
    // so that wireConnection() uses the new value for incoming connections.
    if (this.isReady && this.bridgeProcess) {
      void this.invokeCommand({
        payload: peerId,
        requestId: randomUUID(),
        type: "update-expected-peer",
      });
    }
  }

  async destroy() {
    this.failPendingWaiters(
      new Error("Peer session destroyed before a connection was established."),
    );

    for (const [requestId, pending] of this.pendingCommands) {
      pending.reject(new Error(`Peer command ${requestId} was aborted because the session was destroyed.`));
    }
    this.pendingCommands.clear();

    if (this.bridgeProcess) {
      try {
        if (this.isReady) {
          await this.invokeCommand({
            requestId: randomUUID(),
            type: "destroy",
          });
        }
      } catch {
        // Session teardown should be best-effort.
      }

      this.bridgeProcess.kill();
    }

    this.bridgeProcess = null;
    this.connection = null;
  }

  private async initialize() {
    try {
      this.bridgeProcess = utilityProcess.fork(
        path.join(__dirname, "peer-bridge-worker.js"),
        [],
        { serviceName: `digswap-peer-${this.tradeId}` },
      );

      this.bridgeProcess.on("message", (event: PeerBridgeEvent) => {
        this.eventHandler(event);
      });

      // Send initialization config to the worker
      this.bridgeProcess.postMessage({
        type: "init",
        peerId: this.peerId,
        role: this.role,
        iceServers: this.iceServers,
        expectedRemotePeerId: this.expectedRemotePeerId,
      });
    } catch (error) {
      this.failSession(error instanceof Error ? error : new Error("Failed to initialize peer session."));
    }
  }

  private async ensureReady() {
    await this.readyPromise;
  }

  private handleEvent(event: PeerBridgeEvent) {
    switch (event.type) {
      case "peer-open":
        this.isReady = true;
        this.resolveReady?.();
        this.resolveReady = null;
        this.rejectReady = null;
        if (this.callbacks.onPeerIdRegistered) {
          this.callbacks.onPeerIdRegistered(this.peerId);
        }
        return;
      case "command-response":
        if (!event.requestId) {
          return;
        }

        this.resolvePendingCommand(event.requestId, event.error, event.payload);
        return;
      case "connected":
        this.handleConnected(event.peerId ?? this.expectedRemotePeerId);
        return;
      case "disconnected":
        this.callbacks.onDisconnected();
        this.connection?.emit("close");
        return;
      case "data-json":
        this.connection?.emit("data", event.payload);
        return;
      case "data-buffer":
        this.connection?.emit("data", coerceBuffer(event.payload));
        return;
      case "ice-candidate":
        if (event.payload === "host" || event.payload === "srflx" || event.payload === "relay") {
          this.callbacks.onIceCandidate(event.payload);
        }
        return;
      case "error": {
        const error = new Error(event.error ?? "Unknown peer session error.");
        this.failSession(error);
        this.callbacks.onError(error);
        this.connection?.emit("error", error);
        return;
      }
      default:
        return;
    }
  }

  private handleConnected(remotePeerId: string) {
    if (!this.connection) {
      this.connection = new PeerConnectionBridge(this, remotePeerId);
    }

    this.callbacks.onConnected();

    for (const waiter of this.waiters) {
      waiter.resolve(this.connection);
    }
    this.waiters.clear();
  }

  private resolvePendingCommand(requestId: string, error?: string, payload?: unknown) {
    const pending = this.pendingCommands.get(requestId);
    if (!pending) {
      return;
    }

    this.pendingCommands.delete(requestId);

    if (error) {
      pending.reject(new Error(error));
      return;
    }

    pending.resolve(payload);
  }

  async sendPayload(payload: ArrayBuffer | Buffer | Uint8Array | Record<string, unknown>) {
    const isBinaryPayload =
      payload instanceof ArrayBuffer ||
      Buffer.isBuffer(payload) ||
      payload instanceof Uint8Array;

    await this.invokeCommand({
      kind: isBinaryPayload ? "buffer" : "json",
      payload,
      requestId: randomUUID(),
      type: "send",
    });
  }

  async closeConnection() {
    await this.invokeCommand({
      requestId: randomUUID(),
      type: "close-connection",
    });
  }

  private async invokeCommand(command: PeerCommandMessage) {
    await this.ensureReady();

    if (!this.bridgeProcess) {
      throw new Error("Peer session bridge process is no longer available.");
    }

    return new Promise<unknown>((resolve, reject) => {
      this.pendingCommands.set(command.requestId, {
        reject,
        resolve,
      });

      this.bridgeProcess?.postMessage(command);
    });
  }

  private failPendingWaiters(error: Error) {
    if (this.rejectReady) {
      this.rejectReady(error);
      this.rejectReady = null;
      this.resolveReady = null;
    }

    for (const waiter of this.waiters) {
      waiter.reject(error);
    }
    this.waiters.clear();

    for (const waiter of this.expectedPeerIdWaiters) {
      waiter.reject(error);
    }
    this.expectedPeerIdWaiters.clear();
  }

  private failSession(error: Error) {
    this.failPendingWaiters(error);

    for (const [requestId, pending] of this.pendingCommands) {
      pending.reject(
        new Error(`Peer command ${requestId} failed because the session became unavailable: ${error.message}`),
      );
    }
    this.pendingCommands.clear();
  }
}

function coerceBuffer(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (value && typeof value === "object" && "data" in value) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return Buffer.from(data);
    }
  }

  throw new Error("Received an invalid binary payload from the peer bridge.");
}
