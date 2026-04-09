import type { MultiItemCompleteEvent, MultiItemProgressEvent } from "../../shared/ipc-types";
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

export async function sendMultiItemBatch(
  _conn: PeerTransportConnection,
  _tradeId: string,
  _items: BatchTransferItem[],
  _callbacks: MultiItemTransferCallbacks,
  _startFromIndex = 0,
): Promise<void> {
  // TODO: implement
}

export async function receiveMultiItemBatch(
  _conn: PeerTransportConnection,
  _tradeId: string,
  _items: ReceiveBatchItem[],
  _callbacks: MultiItemTransferCallbacks,
  _startFromIndex = 0,
): Promise<void> {
  // TODO: implement
}
