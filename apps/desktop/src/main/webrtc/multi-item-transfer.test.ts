import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TransferCallbacks } from "./chunked-transfer";
import type { PeerTransportConnection } from "./peer-session";
import type { MultiItemTransferCallbacks, BatchTransferItem, ReceiveBatchItem } from "./multi-item-transfer";

// Mock chunked-transfer module
vi.mock("./chunked-transfer", () => ({
  sendFile: vi.fn(),
  receiveFile: vi.fn(),
}));

import { sendFile, receiveFile } from "./chunked-transfer";
import { sendMultiItemBatch, receiveMultiItemBatch } from "./multi-item-transfer";

const mockSendFile = vi.mocked(sendFile);
const mockReceiveFile = vi.mocked(receiveFile);

function createMockConnection(): PeerTransportConnection {
  return {
    remotePeerId: "test-peer",
    close: vi.fn(),
    on: vi.fn().mockReturnThis(),
    off: vi.fn().mockReturnThis(),
    once: vi.fn().mockReturnThis(),
    send: vi.fn(),
  };
}

function createMockCallbacks(): MultiItemTransferCallbacks {
  return {
    onItemProgress: vi.fn(),
    onItemComplete: vi.fn(),
    onBatchComplete: vi.fn(),
    onError: vi.fn(),
  };
}

function makeSendItems(count: number): BatchTransferItem[] {
  return Array.from({ length: count }, (_, i) => ({
    proposalItemId: `item-${i}`,
    filePath: `/tmp/audio-${i}.flac`,
    sha256: `sha256hash${i}`,
  }));
}

function makeReceiveItems(count: number): ReceiveBatchItem[] {
  return Array.from({ length: count }, (_, i) => ({
    proposalItemId: `item-${i}`,
    partPath: `/tmp/audio-${i}.part`,
    finalPath: `/tmp/audio-${i}.flac`,
    expectedSha256: `sha256hash${i}`,
  }));
}

describe("sendMultiItemBatch", () => {
  let conn: PeerTransportConnection;
  let callbacks: MultiItemTransferCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    conn = createMockConnection();
    callbacks = createMockCallbacks();
  });

  it("Test 1: calls sendFile once per item for 1-item batch", async () => {
    const items = makeSendItems(1);
    mockSendFile.mockImplementation(async (_conn, _path, innerCb: TransferCallbacks) => {
      innerCb.onProgress(1024, 2048);
      innerCb.onComplete("/tmp/audio-0.flac", "sha256hash0");
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(mockSendFile).toHaveBeenCalledTimes(1);
    expect(mockSendFile).toHaveBeenCalledWith(conn, "/tmp/audio-0.flac", expect.any(Object));
  });

  it("Test 2: calls sendFile 2 times sequentially for 2-item batch", async () => {
    const items = makeSendItems(2);
    const callOrder: number[] = [];

    mockSendFile.mockImplementation(async (_conn, filePath, innerCb: TransferCallbacks) => {
      const index = filePath === "/tmp/audio-0.flac" ? 0 : 1;
      callOrder.push(index);
      innerCb.onComplete(filePath as string, `sha256hash${index}`);
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(mockSendFile).toHaveBeenCalledTimes(2);
    expect(callOrder).toEqual([0, 1]);
  });

  it("Test 3: calls sendFile 3 times sequentially for 3-item batch", async () => {
    const items = makeSendItems(3);
    const callOrder: number[] = [];

    mockSendFile.mockImplementation(async (_conn, filePath, innerCb: TransferCallbacks) => {
      const index = Number.parseInt((filePath as string).match(/audio-(\d+)/)?.[1] ?? "0");
      callOrder.push(index);
      innerCb.onComplete(filePath as string, `sha256hash${index}`);
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(mockSendFile).toHaveBeenCalledTimes(3);
    expect(callOrder).toEqual([0, 1, 2]);
  });

  it("Test 4: fires onItemProgress with correct itemIndex and proposalItemId", async () => {
    const items = makeSendItems(2);

    mockSendFile.mockImplementation(async (_conn, filePath, innerCb: TransferCallbacks) => {
      innerCb.onProgress(512, 1024);
      innerCb.onComplete(filePath as string, "hash");
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onItemProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: "trade-1",
        itemIndex: 0,
        totalItems: 2,
        proposalItemId: "item-0",
        bytesTransferred: 512,
        totalBytes: 1024,
      }),
    );
    expect(callbacks.onItemProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: "trade-1",
        itemIndex: 1,
        totalItems: 2,
        proposalItemId: "item-1",
        bytesTransferred: 512,
        totalBytes: 1024,
      }),
    );
  });

  it("Test 5: fires onItemComplete after each item's sendFile resolves", async () => {
    const items = makeSendItems(2);

    mockSendFile.mockImplementation(async (_conn, filePath, innerCb: TransferCallbacks) => {
      const index = Number.parseInt((filePath as string).match(/audio-(\d+)/)?.[1] ?? "0");
      innerCb.onComplete(filePath as string, `sha256hash${index}`);
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onItemComplete).toHaveBeenCalledTimes(2);
    expect(callbacks.onItemComplete).toHaveBeenCalledWith(0, "item-0", "/tmp/audio-0.flac", "sha256hash0");
    expect(callbacks.onItemComplete).toHaveBeenCalledWith(1, "item-1", "/tmp/audio-1.flac", "sha256hash1");
  });

  it("Test 6: fires onBatchComplete with allVerified=true when all items complete", async () => {
    const items = makeSendItems(2);

    mockSendFile.mockImplementation(async (_conn, filePath, innerCb: TransferCallbacks) => {
      const index = Number.parseInt((filePath as string).match(/audio-(\d+)/)?.[1] ?? "0");
      innerCb.onComplete(filePath as string, `sha256hash${index}`);
    });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onBatchComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: "trade-1",
        allVerified: true,
        completedItems: [
          { proposalItemId: "item-0", filePath: "/tmp/audio-0.flac", sha256: "sha256hash0" },
          { proposalItemId: "item-1", filePath: "/tmp/audio-1.flac", sha256: "sha256hash1" },
        ],
      }),
    );
  });

  it("Test 7: if item 0 fails, fires onError and continues to item 1", async () => {
    const items = makeSendItems(2);
    const error = new Error("Send failed for item 0");

    mockSendFile
      .mockImplementationOnce(async () => {
        throw error;
      })
      .mockImplementationOnce(async (_conn, filePath, innerCb: TransferCallbacks) => {
        innerCb.onComplete(filePath as string, "sha256hash1");
      });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(0, "item-0", error);
    expect(callbacks.onItemComplete).toHaveBeenCalledWith(1, "item-1", "/tmp/audio-1.flac", "sha256hash1");
  });

  it("Test 8: onBatchComplete has allVerified=false when any item errored", async () => {
    const items = makeSendItems(2);

    mockSendFile
      .mockImplementationOnce(async () => {
        throw new Error("Send failed");
      })
      .mockImplementationOnce(async (_conn, filePath, innerCb: TransferCallbacks) => {
        innerCb.onComplete(filePath as string, "sha256hash1");
      });

    await sendMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onBatchComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: "trade-1",
        allVerified: false,
        completedItems: [
          { proposalItemId: "item-1", filePath: "/tmp/audio-1.flac", sha256: "sha256hash1" },
        ],
      }),
    );
  });
});

describe("receiveMultiItemBatch", () => {
  let conn: PeerTransportConnection;
  let callbacks: MultiItemTransferCallbacks;

  beforeEach(() => {
    vi.clearAllMocks();
    conn = createMockConnection();
    callbacks = createMockCallbacks();
  });

  it("Test 9: calls receiveFile once per item for 1-item batch", async () => {
    const items = makeReceiveItems(1);

    mockReceiveFile.mockImplementation(
      async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash0");
      },
    );

    await receiveMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(mockReceiveFile).toHaveBeenCalledTimes(1);
    expect(mockReceiveFile).toHaveBeenCalledWith(
      conn,
      "/tmp/audio-0.part",
      "/tmp/audio-0.flac",
      "sha256hash0",
      expect.any(Object),
    );
  });

  it("Test 10: calls receiveFile 3 times sequentially for 3-item batch", async () => {
    const items = makeReceiveItems(3);
    const callOrder: number[] = [];

    mockReceiveFile.mockImplementation(
      async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        const index = Number.parseInt((finalPath as string).match(/audio-(\d+)/)?.[1] ?? "0");
        callOrder.push(index);
        innerCb.onComplete(finalPath as string, `sha256hash${index}`);
      },
    );

    await receiveMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(mockReceiveFile).toHaveBeenCalledTimes(3);
    expect(callOrder).toEqual([0, 1, 2]);
  });

  it("Test 11: if item index 1 fails, resumes at index 1 on retry (startFromIndex=1)", async () => {
    const items = makeReceiveItems(3);

    // First call: item 0 succeeds, item 1 fails, item 2 still runs
    mockReceiveFile
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash0");
      })
      .mockImplementationOnce(async () => {
        throw new Error("Receive failed at item 1");
      })
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash2");
      });

    await receiveMultiItemBatch(conn, "trade-1", items, callbacks);

    // Now retry from index 1 only
    vi.clearAllMocks();
    callbacks = createMockCallbacks();

    mockReceiveFile
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash1");
      })
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash2");
      });

    await receiveMultiItemBatch(conn, "trade-1", items, callbacks, 1);

    // startFromIndex=1 means item 0 is skipped
    expect(mockReceiveFile).toHaveBeenCalledTimes(2);
    expect(mockReceiveFile).toHaveBeenCalledWith(
      conn,
      "/tmp/audio-1.part",
      "/tmp/audio-1.flac",
      "sha256hash1",
      expect.any(Object),
    );
  });

  it("Test 12: fires onBatchComplete with completedItems containing only successful items", async () => {
    const items = makeReceiveItems(3);

    mockReceiveFile
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash0");
      })
      .mockImplementationOnce(async () => {
        throw new Error("Receive failed at item 1");
      })
      .mockImplementationOnce(async (_conn, _part, finalPath, _sha, innerCb: TransferCallbacks) => {
        innerCb.onComplete(finalPath as string, "sha256hash2");
      });

    await receiveMultiItemBatch(conn, "trade-1", items, callbacks);

    expect(callbacks.onBatchComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        tradeId: "trade-1",
        allVerified: false,
        completedItems: [
          { proposalItemId: "item-0", filePath: "/tmp/audio-0.flac", sha256: "sha256hash0" },
          { proposalItemId: "item-2", filePath: "/tmp/audio-2.flac", sha256: "sha256hash2" },
        ],
      }),
    );
  });
});
