import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function createElectronHarness() {
  class MockIpcMain extends EventEmitter {
    emitBridge(eventChannel: string, event: Record<string, unknown>) {
      this.emit(eventChannel, {} as never, event);
    }
  }

  const ipcMain = new MockIpcMain();
  const bridges = new Map<string, { eventChannel: string; peerId: string }>();

  function readBridgeConstant(script: string, name: string) {
    const match = script.match(new RegExp(`const ${name} = (.*?);`));
    if (!match) {
      throw new Error(`Unable to read ${name} from the peer bridge script.`);
    }

    return JSON.parse(match[1]) as string;
  }

  class MockBrowserWindow {
    private destroyed = false;

    webContents = {
      executeJavaScript: async (script: string) => {
        const commandChannel = readBridgeConstant(script, "commandChannel");
        const eventChannel = readBridgeConstant(script, "eventChannel");
        const peerId = readBridgeConstant(script, "peerId");

        bridges.set(commandChannel, {
          eventChannel,
          peerId,
        });

        queueMicrotask(() => {
          ipcMain.emitBridge(eventChannel, {
            peerId,
            type: "peer-open",
          });
        });
      },
      send: (commandChannel: string, command: { requestId: string; type: string }) => {
        const bridge = bridges.get(commandChannel);
        if (!bridge) {
          throw new Error(`Missing mock bridge state for ${commandChannel}.`);
        }

        if (
          command.type === "close-connection" ||
          command.type === "destroy" ||
          command.type === "update-expected-peer"
        ) {
          queueMicrotask(() => {
            ipcMain.emitBridge(bridge.eventChannel, {
              payload: true,
              requestId: command.requestId,
              type: "command-response",
            });
          });
        }
      },
    };

    async loadURL() {
      return undefined;
    }

    destroy() {
      this.destroyed = true;
    }

    isDestroyed() {
      return this.destroyed;
    }
  }

  return {
    BrowserWindow: MockBrowserWindow,
    dialog: {
      showOpenDialog: vi.fn(),
    },
    ipcMain,
    reset() {
      bridges.clear();
      ipcMain.removeAllListeners();
    },
  };
}

const electronHarness = createElectronHarness();
const chunkedTransferMocks = {
  receiveFile: vi.fn(),
  sendFile: vi.fn(),
};

vi.doMock("electron", () => ({
  BrowserWindow: electronHarness.BrowserWindow,
  dialog: electronHarness.dialog,
  ipcMain: electronHarness.ipcMain,
}));

vi.doMock("../src/main/webrtc/chunked-transfer", () => ({
  receiveFile: chunkedTransferMocks.receiveFile,
  sendFile: chunkedTransferMocks.sendFile,
}));

const { DesktopTradeRuntime } = await import("../src/main/trade-runtime");
const { PeerSession } = await import("../src/main/webrtc/peer-session");

class MockRealtimeChannel {
  private onStatus: ((status: string) => void) | null = null;
  private onUpdate: ((payload: { new: Record<string, unknown> }) => void) | null = null;

  on(
    _event: string,
    _filter: Record<string, unknown>,
    handler: (payload: { new: Record<string, unknown> }) => void,
  ) {
    this.onUpdate = handler;
    return this;
  }

  subscribe(callback: (status: string) => void) {
    this.onStatus = callback;
    queueMicrotask(() => callback("SUBSCRIBED"));
    return this;
  }

  emitUpdate(row: Record<string, unknown>) {
    this.onUpdate?.({
      new: row,
    });
  }

  async unsubscribe() {
    return "ok";
  }
}

function createRuntime(overrides?: {
  client?: {
    channel: (name: string) => MockRealtimeChannel;
    from: (table: string) => {
      eq: (column: string, value: string) => unknown;
      is: (column: string, value: null) => unknown;
      maybeSingle?: () => Promise<unknown>;
      neq?: (column: string, value: string) => unknown;
      not?: (column: string, operator: string, value: null) => unknown;
      select: (columns: string) => unknown;
    };
    rpc: (name: string, payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
  session?: {
    user: {
      id: string;
    };
  } | null;
}) {
  const client = overrides?.client ?? {
    channel: () => new MockRealtimeChannel(),
    from: () => {
      throw new Error("Unexpected snapshot query in this test.");
    },
    rpc: async () => ({ error: null }),
  };
  const session = overrides?.session ?? {
    user: {
      id: "user-1",
    },
  };

  const authRuntime = {
    getClientOrThrow: vi.fn(() => client),
    getSession: vi.fn(async () => session),
    onSessionChanged: vi.fn(() => () => undefined),
  };
  const sessionStore = {
    getOrCreateDeviceId: vi.fn(() => "device-1"),
  };

  return new DesktopTradeRuntime(null, authRuntime as never, sessionStore as never);
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

beforeEach(() => {
  chunkedTransferMocks.receiveFile.mockReset();
  chunkedTransferMocks.sendFile.mockReset();
});

afterEach(() => {
  electronHarness.reset();
  vi.clearAllMocks();
});

describe("peer handshake coordination", () => {
  it("resolves waitForExpectedPeerIdUpdate once the placeholder is replaced", async () => {
    const session = new PeerSession("trade-abc", "sender", [], {
      onConnected: vi.fn(),
      onDisconnected: vi.fn(),
      onError: vi.fn(),
      onIceCandidate: vi.fn(),
      onPeerIdRegistered: vi.fn(),
    });

    const expectedRemotePeerId = "trade-abc-0123456789abcdef-r";
    const waitForPeerId = session.waitForExpectedPeerIdUpdate(1_000);
    session.updateExpectedRemotePeerId(expectedRemotePeerId);

    await expect(waitForPeerId).resolves.toBe(expectedRemotePeerId);
    await session.destroy();
  });

  it("runSenderTransfer waits for the real peer ID before calling connect", async () => {
    const runtime = createRuntime();
    const runtimeState = runtime as never as {
      activeSessions: Map<string, { partPath: string | null; realtimeChannel: MockRealtimeChannel | null; role: "sender" | "receiver"; session: { destroy: () => Promise<void> } }>;
      runSenderTransfer: (
        tradeId: string,
        session: {
          connect: () => Promise<Record<string, unknown>>;
          destroy: () => Promise<void>;
          waitForExpectedPeerIdUpdate: (timeoutMs: number) => Promise<string>;
        },
        sourceFilePath: string,
      ) => Promise<void>;
    };

    const gate = createDeferred<string>();
    const fakeSession = {
      connect: vi.fn(async () => ({
        remotePeerId: "trade-abc-0123456789abcdef-r",
      })),
      destroy: vi.fn(async () => undefined),
      waitForExpectedPeerIdUpdate: vi.fn(async () => gate.promise),
    };

    runtimeState.activeSessions.set("trade-abc", {
      partPath: null,
      realtimeChannel: null,
      role: "sender",
      session: fakeSession,
    });

    chunkedTransferMocks.sendFile.mockImplementation(async (_connection, _sourceFilePath, callbacks) => {
      callbacks.onComplete("C:/tmp/test.flac", "sha256");
    });

    const transferPromise = runtimeState.runSenderTransfer(
      "trade-abc",
      fakeSession,
      "C:/tmp/test.flac",
    );

    await Promise.resolve();
    expect(fakeSession.waitForExpectedPeerIdUpdate).toHaveBeenCalledWith(15_000);
    expect(fakeSession.connect).not.toHaveBeenCalled();

    gate.resolve("trade-abc-0123456789abcdef-r");
    await transferPromise;

    expect(fakeSession.connect).toHaveBeenCalledTimes(1);
    expect(chunkedTransferMocks.sendFile).toHaveBeenCalledTimes(1);
  });

  it("publishAndSubscribePeerId hydrates the counterparty peer ID from the snapshot when the UPDATE was missed", async () => {
    const events: string[] = [];
    const realtimeChannel = new MockRealtimeChannel();
    const snapshotPeerId = "trade-abc-fedcba9876543210-r";

    const snapshotQuery = {
      eq: vi.fn(() => snapshotQuery),
      is: vi.fn(() => snapshotQuery),
      maybeSingle: vi.fn(async () => {
        events.push("snapshot");
        return {
          data: {
            peer_id: snapshotPeerId,
            user_id: "user-2",
          },
          error: null,
        };
      }),
      neq: vi.fn(() => snapshotQuery),
      not: vi.fn(() => snapshotQuery),
      select: vi.fn(() => snapshotQuery),
    };

    const client = {
      channel: vi.fn(() => {
        events.push("channel");
        return realtimeChannel;
      }),
      from: vi.fn(() => snapshotQuery),
      rpc: vi.fn(async () => {
        events.push("publish");
        return {
          error: null,
        };
      }),
    };

    const runtime = createRuntime({
      client,
    });
    const runtimeState = runtime as never as {
      activeSessions: Map<string, { partPath: string | null; realtimeChannel: MockRealtimeChannel | null; role: "sender" | "receiver"; session: { destroy: () => Promise<void> } }>;
      publishAndSubscribePeerId: (
        tradeId: string,
        peerId: string,
        session: {
          updateExpectedRemotePeerId: (peerId: string) => void;
        },
      ) => Promise<void>;
    };

    const session = {
      destroy: vi.fn(async () => undefined),
      updateExpectedRemotePeerId: vi.fn((peerId: string) => {
        events.push(`update:${peerId}`);
      }),
    };

    runtimeState.activeSessions.set("trade-abc", {
      partPath: null,
      realtimeChannel: null,
      role: "receiver",
      session,
    });

    const originalSubscribe = realtimeChannel.subscribe.bind(realtimeChannel);
    realtimeChannel.subscribe = ((callback: (status: string) => void) => {
      events.push("subscribe");
      return originalSubscribe((status) => {
        events.push(status.toLowerCase());
        callback(status);
      });
    }) as typeof realtimeChannel.subscribe;

    await runtimeState.publishAndSubscribePeerId(
      "trade-abc",
      "trade-abc-1234567890abcdef-s",
      session,
    );

    expect(events).toEqual([
      "channel",
      "subscribe",
      "subscribed",
      "snapshot",
      `update:${snapshotPeerId}`,
      "publish",
    ]);
    expect(session.updateExpectedRemotePeerId).toHaveBeenCalledWith(snapshotPeerId);
    expect(client.from).toHaveBeenCalledWith("trade_runtime_sessions");
    expect(client.rpc).toHaveBeenCalledWith("update_trade_peer_id", {
      p_device_id: "device-1",
      p_peer_id: "trade-abc-1234567890abcdef-s",
      p_trade_id: "trade-abc",
    });

    realtimeChannel.emitUpdate({
      peer_id: "trade-abc-1111111111111111-r",
      user_id: "user-2",
    });

    expect(session.updateExpectedRemotePeerId).toHaveBeenLastCalledWith(
      "trade-abc-1111111111111111-r",
    );
  });
});
