import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { BrowserWindow, ipcMain } from "electron";

export type PeerRole = "sender" | "receiver";

export interface PeerSessionCallbacks {
  onConnected(): void;
  onDisconnected(): void;
  onError(err: Error): void;
  onIceCandidate(type: "host" | "srflx" | "relay"): void;
}

type PendingResolver = {
  reject: (error: Error) => void;
  resolve: (result: unknown) => void;
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
  type: "close-connection" | "connect" | "destroy" | "send";
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
  private readonly commandChannel = `digswap-peer-command:${randomUUID()}`;
  private readonly eventChannel = `digswap-peer-event:${randomUUID()}`;
  private readonly peerId: string;
  private readonly expectedRemotePeerId: string;
  private readonly pendingCommands = new Map<string, PendingResolver>();
  private readonly eventHandler: BridgeEventHandler;
  private bridgeWindow: BrowserWindow | null = null;
  private connection: PeerConnectionBridge | null = null;
  private isReady = false;
  private readyPromise: Promise<void>;
  private rejectReady: ((error: Error) => void) | null = null;
  private resolveReady: (() => void) | null = null;
  private waiters = new Set<PendingResolver>();

  constructor(
    private readonly tradeId: string,
    private readonly role: PeerRole,
    private readonly iceServers: RTCIceServer[],
    private readonly callbacks: PeerSessionCallbacks,
  ) {
    this.peerId = role === "sender" ? `${tradeId}-s` : `${tradeId}-r`;
    this.expectedRemotePeerId = role === "sender" ? `${tradeId}-r` : `${tradeId}-s`;
    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.rejectReady = reject;
      this.resolveReady = resolve;
    });
    this.eventHandler = (event) => {
      this.handleEvent(event);
    };

    ipcMain.on(this.eventChannel, this.onEventFromBridge);
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

      const waiter: PendingResolver = {
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        resolve: (connection) => {
          clearTimeout(timeoutId);
          resolve(connection as PeerTransportConnection);
        },
      };

      this.waiters.add(waiter);
    });
  }

  async destroy() {
    this.failPendingWaiters(
      new Error("Peer session destroyed before a connection was established."),
    );

    for (const [requestId, pending] of this.pendingCommands) {
      pending.reject(new Error(`Peer command ${requestId} was aborted because the session was destroyed.`));
    }
    this.pendingCommands.clear();

    if (this.bridgeWindow && !this.bridgeWindow.isDestroyed()) {
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

      this.bridgeWindow.destroy();
    }

    this.bridgeWindow = null;
    this.connection = null;
    ipcMain.removeListener(this.eventChannel, this.onEventFromBridge);
  }

  private onEventFromBridge = (_event: Electron.IpcMainEvent, event: PeerBridgeEvent) => {
    this.eventHandler(event);
  };

  private async initialize() {
    try {
      this.bridgeWindow = new BrowserWindow({
        show: false,
        webPreferences: {
          backgroundThrottling: false,
          contextIsolation: false,
          nodeIntegration: true,
          sandbox: false,
        },
      });

      await this.bridgeWindow.loadURL("about:blank");
      await this.bridgeWindow.webContents.executeJavaScript(
        buildPeerBridgeScript({
          commandChannel: this.commandChannel,
          eventChannel: this.eventChannel,
          expectedRemotePeerId: this.expectedRemotePeerId,
          iceServers: this.iceServers,
          peerId: this.peerId,
          role: this.role,
        }),
        true,
      );
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
      payload: isBinaryPayload ? serializeBinaryPayload(payload) : payload,
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

    if (!this.bridgeWindow || this.bridgeWindow.isDestroyed()) {
      throw new Error("Peer session bridge window is no longer available.");
    }

    return new Promise<unknown>((resolve, reject) => {
      this.pendingCommands.set(command.requestId, {
        reject,
        resolve,
      });

      this.bridgeWindow?.webContents.send(this.commandChannel, command);
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

function serializeBinaryPayload(payload: ArrayBuffer | Buffer | Uint8Array) {
  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (payload instanceof Uint8Array) {
    return Buffer.from(payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength));
  }

  return Buffer.from(payload);
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

function buildPeerBridgeScript({
  commandChannel,
  eventChannel,
  expectedRemotePeerId,
  iceServers,
  peerId,
  role,
}: {
  commandChannel: string;
  eventChannel: string;
  expectedRemotePeerId: string;
  iceServers: RTCIceServer[];
  peerId: string;
  role: PeerRole;
}) {
  return `
(() => {
  const { ipcRenderer } = require("electron");
  const PeerModule = require("peerjs");
  const Peer = PeerModule.default ?? PeerModule.Peer ?? PeerModule;
  const commandChannel = ${JSON.stringify(commandChannel)};
  const eventChannel = ${JSON.stringify(eventChannel)};
  const expectedRemotePeerId = ${JSON.stringify(expectedRemotePeerId)};
  const peerId = ${JSON.stringify(peerId)};
  const role = ${JSON.stringify(role)};
  const iceServers = ${JSON.stringify(iceServers)};
  const seenIceTypes = new Set();
  let conn = null;
  let peer = null;

  function emit(type, payload = {}) {
    ipcRenderer.send(eventChannel, { type, ...payload });
  }

  function respond(requestId, payload = {}) {
    emit("command-response", { requestId, ...payload });
  }

  function parseCandidateType(candidateValue) {
    if (typeof candidateValue !== "string") {
      return null;
    }

    const match = candidateValue.match(/ typ (host|srflx|relay) /u);
    return match ? match[1] : null;
  }

  function toArrayBufferLike(value) {
    if (value instanceof ArrayBuffer) {
      return value;
    }

    if (ArrayBuffer.isView(value)) {
      return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
    }

    if (value && typeof value === "object" && Array.isArray(value.data)) {
      return Uint8Array.from(value.data).buffer;
    }

    return value;
  }

  function startIceTracking(connection) {
    const pc =
      connection.peerConnection ||
      connection._peerConnection ||
      connection._negotiator?._pc ||
      connection._negotiator?.pc ||
      null;

    if (!pc || typeof pc.addEventListener !== "function") {
      return;
    }

    pc.addEventListener("icecandidate", (event) => {
      const candidateString = event?.candidate?.candidate ?? "";
      const candidateType = parseCandidateType(candidateString);

      if (candidateType && !seenIceTypes.has(candidateType)) {
        seenIceTypes.add(candidateType);
        emit("ice-candidate", { payload: candidateType });
      }
    });
  }

  function wireConnection(nextConnection) {
    conn = nextConnection;

    if (conn.peer !== expectedRemotePeerId) {
      emit("error", { error: \`Unexpected peer connection from \${conn.peer}\` });
      try {
        conn.close();
      } catch {}
      return;
    }

    startIceTracking(conn);

    conn.on("open", () => {
      emit("connected", { peerId: conn.peer });
    });

    conn.on("close", () => {
      emit("disconnected");
    });

    conn.on("error", (error) => {
      emit("error", { error: error?.message ?? "Peer connection error" });
    });

    conn.on("data", (data) => {
      if (data && typeof data === "object" && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data) && !Array.isArray(data)) {
        emit("data-json", { payload: data });
        return;
      }

      const normalized = toArrayBufferLike(data);
      const buffer = Buffer.from(normalized);
      emit("data-buffer", { payload: buffer });
    });
  }

  peer = new Peer(peerId, {
    config: {
      iceServers,
    },
  });

  peer.on("open", () => {
    emit("peer-open", { peerId });
  });

  peer.on("error", (error) => {
    emit("error", { error: error?.message ?? "Peer session error" });
  });

  if (role === "receiver") {
    peer.on("connection", (nextConnection) => {
      wireConnection(nextConnection);
    });
  }

  ipcRenderer.on(commandChannel, async (_event, command) => {
    try {
      switch (command.type) {
        case "connect": {
          if (role !== "sender") {
            respond(command.requestId, { error: "Only sender sessions can initiate connections." });
            return;
          }

          if (conn && conn.open) {
            respond(command.requestId, { payload: true });
            return;
          }

          const nextConnection = peer.connect(expectedRemotePeerId, { reliable: true });
          const onOpen = () => {
            respond(command.requestId, { payload: true });
          };
          const onError = (error) => {
            respond(command.requestId, { error: error?.message ?? "Failed to connect to peer." });
          };

          nextConnection.once("open", onOpen);
          nextConnection.once("error", onError);
          wireConnection(nextConnection);
          return;
        }

        case "send": {
          if (!conn || !conn.open) {
            respond(command.requestId, { error: "Cannot send data before the peer connection is open." });
            return;
          }

          const payload =
            command.kind === "buffer"
              ? toArrayBufferLike(command.payload)
              : command.payload;

          conn.send(payload);

          const dataChannel =
            conn.dataChannel ||
            conn._dc ||
            null;

          if (dataChannel && dataChannel.bufferedAmount > 1024 * 1024) {
            await new Promise((resolve) => {
              const onLow = () => {
                dataChannel.removeEventListener("bufferedamountlow", onLow);
                resolve();
              };
              dataChannel.bufferedAmountLowThreshold = 256 * 1024;
              dataChannel.addEventListener("bufferedamountlow", onLow);
            });
          }

          respond(command.requestId, { payload: true });
          return;
        }

        case "close-connection": {
          if (conn) {
            conn.close();
            conn = null;
          }
          respond(command.requestId, { payload: true });
          return;
        }

        case "destroy": {
          if (conn) {
            try {
              conn.close();
            } catch {}
            conn = null;
          }

          if (peer && !peer.destroyed) {
            peer.destroy();
          }

          respond(command.requestId, { payload: true });
          return;
        }

        default:
          respond(command.requestId, { error: "Unknown peer command." });
      }
    } catch (error) {
      respond(command.requestId, {
        error: error instanceof Error ? error.message : "Unexpected peer bridge error",
      });
    }
  });
})();
`;
}
