import type { MultiItemCompleteEvent, MultiItemProgressEvent } from "../../shared/ipc-types";
import { receiveFile, sendFile } from "./chunked-transfer";
import type { PeerTransportConnection } from "./peer-session";

export interface BatchTransferItem {
  proposalItemId: string;
  filePath: string;
  sha256: string;
}

export interface ReceiveBatchItem {
  proposalItemId: string;
  partPath: string;
  finalPath: string;
  expectedSha256: string;
}

export interface MultiItemTransferCallbacks {
  onItemProgress(event: MultiItemProgressEvent): void;
  onItemComplete(index: number, proposalItemId: string, filePath: string, sha256: string): void;
  onBatchComplete(event: MultiItemCompleteEvent): void;
  onError(itemIndex: number, proposalItemId: string, err: Error): void;
}

/**
 * Sends multiple items sequentially over a single peer connection.
 * If an item fails, the error is reported via onError and the batch continues
 * with the remaining items (non-blocking error model).
 *
 * @param startFromIndex - Skip items before this index (for resume after partial failure)
 */
export async function sendMultiItemBatch(
  conn: PeerTransportConnection,
  tradeId: string,
  items: BatchTransferItem[],
  callbacks: MultiItemTransferCallbacks,
  startFromIndex = 0,
): Promise<void> {
  const totalItems = items.length;
  const completedItems: Array<{ proposalItemId: string; filePath: string; sha256: string }> = [];
  const erroredIndices = new Set<number>();

  for (let i = startFromIndex; i < items.length; i++) {
    const item = items[i];

    try {
      await sendFile(conn, item.filePath, {
        onProgress(bytesTransferred: number, totalBytes: number) {
          callbacks.onItemProgress({
            tradeId,
            itemIndex: i,
            totalItems,
            proposalItemId: item.proposalItemId,
            bytesTransferred,
            totalBytes,
          });
        },
        onComplete(filePath: string, sha256: string) {
          completedItems.push({
            proposalItemId: item.proposalItemId,
            filePath,
            sha256,
          });
          callbacks.onItemComplete(i, item.proposalItemId, filePath, sha256);
        },
        onError(_err: Error) {
          // Error handling is done at the outer try/catch level
        },
      });
    } catch (err) {
      erroredIndices.add(i);
      callbacks.onError(
        i,
        item.proposalItemId,
        err instanceof Error ? err : new Error("Unknown send error"),
      );
    }
  }

  callbacks.onBatchComplete({
    tradeId,
    completedItems,
    allVerified: erroredIndices.size === 0,
  });
}

/**
 * Receives multiple items sequentially over a single peer connection.
 * If an item fails, the error is reported via onError and the batch continues
 * with the remaining items (non-blocking error model).
 *
 * @param startFromIndex - Skip items before this index (for resume after partial failure)
 */
export async function receiveMultiItemBatch(
  conn: PeerTransportConnection,
  tradeId: string,
  items: ReceiveBatchItem[],
  callbacks: MultiItemTransferCallbacks,
  startFromIndex = 0,
): Promise<void> {
  const totalItems = items.length;
  const completedItems: Array<{ proposalItemId: string; filePath: string; sha256: string }> = [];
  const erroredIndices = new Set<number>();

  for (let i = startFromIndex; i < items.length; i++) {
    const item = items[i];

    try {
      await receiveFile(conn, item.partPath, item.finalPath, item.expectedSha256, {
        onProgress(bytesTransferred: number, totalBytes: number) {
          callbacks.onItemProgress({
            tradeId,
            itemIndex: i,
            totalItems,
            proposalItemId: item.proposalItemId,
            bytesTransferred,
            totalBytes,
          });
        },
        onComplete(filePath: string, sha256: string) {
          completedItems.push({
            proposalItemId: item.proposalItemId,
            filePath,
            sha256,
          });
          callbacks.onItemComplete(i, item.proposalItemId, filePath, sha256);
        },
        onError(_err: Error) {
          // Error handling is done at the outer try/catch level
        },
      });
    } catch (err) {
      erroredIndices.add(i);
      callbacks.onError(
        i,
        item.proposalItemId,
        err instanceof Error ? err : new Error("Unknown receive error"),
      );
    }
  }

  callbacks.onBatchComplete({
    tradeId,
    completedItems,
    allVerified: erroredIndices.size === 0,
  });
}
