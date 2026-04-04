/**
 * peer-bridge-worker.ts
 *
 * Standalone Node.js script that runs inside an Electron utilityProcess.
 * Hosts the PeerJS peer instance, handling WebRTC signaling, connections,
 * and data transfer. Communicates with the parent (PeerSession) exclusively
 * via process.parentPort MessagePort IPC.
 *
 * This replaces the previous BrowserWindow + executeJavaScript approach,
 * eliminating the nodeIntegration:true security weakness.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// utilityProcess scripts receive process.parentPort for IPC.
// The parentPort property is injected by Electron at runtime but is not
// present in standard Node.js type definitions, so we access it dynamically.
interface MessagePortLike {
  on(event: "message", listener: (value: { data: unknown }) => void): void;
  postMessage(value: unknown): void;
}

const _parentPort = (process as unknown as { parentPort?: MessagePortLike }).parentPort;

if (!_parentPort) {
  throw new Error("peer-bridge-worker must be run inside an Electron utilityProcess.");
}

// Re-assign to a non-optional const so TypeScript knows it's always defined
// in all closures below (control-flow narrowing doesn't survive closures).
const parentPort: MessagePortLike = _parentPort;

interface InitMessage {
  type: "init";
  peerId: string;
  role: "sender" | "receiver";
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  expectedRemotePeerId: string;
}

interface CommandMessage {
  type: "connect" | "send" | "close-connection" | "destroy" | "update-expected-peer";
  requestId: string;
  kind?: "buffer" | "json";
  payload?: unknown;
}

type IncomingMessage = InitMessage | CommandMessage;

function emit(type: string, extra: Record<string, unknown> = {}) {
  parentPort.postMessage({ type, ...extra });
}

function respond(requestId: string, extra: Record<string, unknown> = {}) {
  emit("command-response", { requestId, ...extra });
}

function parseCandidateType(candidateValue: unknown): string | null {
  if (typeof candidateValue !== "string") {
    return null;
  }

  const match = candidateValue.match(/ typ (host|srflx|relay) /u);
  return match ? match[1] : null;
}

function toBufferLike(value: unknown): Buffer | unknown {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }

  if (value instanceof Uint8Array || ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return Buffer.from(view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength));
  }

  if (value && typeof value === "object" && "data" in (value as Record<string, unknown>)) {
    const data = (value as { data?: unknown }).data;
    if (Array.isArray(data)) {
      return Buffer.from(data);
    }
  }

  return value;
}

let peer: any = null;
let conn: any = null;
let expectedRemotePeerId = "";
const seenIceTypes = new Set<string>();

function startIceTracking(connection: any) {
  const pc =
    connection.peerConnection ||
    connection._peerConnection ||
    connection._negotiator?._pc ||
    connection._negotiator?.pc ||
    null;

  if (!pc || typeof pc.addEventListener !== "function") {
    return;
  }

  pc.addEventListener("icecandidate", (event: any) => {
    const candidateString = event?.candidate?.candidate ?? "";
    const candidateType = parseCandidateType(candidateString);

    if (candidateType && !seenIceTypes.has(candidateType)) {
      seenIceTypes.add(candidateType);
      emit("ice-candidate", { payload: candidateType });
    }
  });
}

function wireConnection(nextConnection: any) {
  conn = nextConnection;

  if (conn.peer !== expectedRemotePeerId) {
    emit("error", { error: `Unexpected peer connection from ${conn.peer}` });
    try {
      conn.close();
    } catch {
      // best-effort close
    }
    return;
  }

  startIceTracking(conn);

  conn.on("open", () => {
    emit("connected", { peerId: conn.peer });
  });

  conn.on("close", () => {
    emit("disconnected");
  });

  conn.on("error", (error: any) => {
    emit("error", { error: error?.message ?? "Peer connection error" });
  });

  conn.on("data", (data: unknown) => {
    if (
      data &&
      typeof data === "object" &&
      !(data instanceof ArrayBuffer) &&
      !ArrayBuffer.isView(data) &&
      !Array.isArray(data)
    ) {
      emit("data-json", { payload: data });
      return;
    }

    const normalized = toBufferLike(data);
    const buffer = Buffer.isBuffer(normalized) ? normalized : Buffer.from(normalized as any);
    emit("data-buffer", { payload: buffer });
  });
}

async function handleCommand(command: CommandMessage) {
  try {
    switch (command.type) {
      case "connect": {
        if (!peer) {
          respond(command.requestId, { error: "Peer not initialized." });
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
        const onError = (error: any) => {
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

        let payload: unknown;
        if (command.kind === "buffer") {
          payload = toBufferLike(command.payload);
        } else {
          payload = command.payload;
        }

        conn.send(payload);

        const dataChannel = conn.dataChannel || conn._dc || null;

        if (dataChannel && dataChannel.bufferedAmount > 1024 * 1024) {
          await new Promise<void>((resolve) => {
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
          } catch {
            // best-effort close
          }
          conn = null;
        }

        if (peer && !peer.destroyed) {
          peer.destroy();
        }

        respond(command.requestId, { payload: true });
        return;
      }

      case "update-expected-peer": {
        if (typeof command.payload === "string" && command.payload) {
          expectedRemotePeerId = command.payload;
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
}

function initializePeer(config: InitMessage) {
  // PeerJS in Node.js context — same resolution pattern as the previous inline script
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PeerModule = require("peerjs");
  const Peer = PeerModule.default ?? PeerModule.Peer ?? PeerModule;

  expectedRemotePeerId = config.expectedRemotePeerId;
  const role = config.role;

  peer = new Peer(config.peerId, {
    config: {
      iceServers: config.iceServers,
    },
  });

  peer.on("open", () => {
    emit("peer-open", { peerId: config.peerId });
  });

  peer.on("error", (error: any) => {
    emit("error", { error: error?.message ?? "Peer session error" });
  });

  if (role === "receiver") {
    peer.on("connection", (nextConnection: any) => {
      wireConnection(nextConnection);
    });
  }
}

// Listen for messages from the parent process (PeerSession)
parentPort.on("message", ({ data }: { data: unknown }) => {
  const msg = data as IncomingMessage;
  if (msg.type === "init") {
    initializePeer(msg as InitMessage);
    return;
  }

  void handleCommand(msg as CommandMessage);
});
