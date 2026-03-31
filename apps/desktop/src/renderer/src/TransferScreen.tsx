import React, { useEffect, useState } from "react";
import type { TransferProgressEvent, TransferCompleteEvent } from "../shared/ipc-types";

interface Props {
  tradeId: string;
  onComplete: (event: TransferCompleteEvent) => void;
  onCancel: () => void;
}

function formatBytes(n: number): string {
  if (n === 0) return "0 B";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function TransferScreen({ tradeId, onComplete, onCancel }: Props) {
  const [progress, setProgress] = useState<TransferProgressEvent | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const unsubProgress = window.desktopBridge.onTransferProgress((event) => {
      setProgress(event);
    });
    const unsubComplete = window.desktopBridge.onTransferComplete((event) => {
      onComplete(event);
    });
    return () => {
      unsubProgress();
      unsubComplete();
    };
  }, [onComplete]);

  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);
    try {
      await window.desktopBridge.cancelTransfer(tradeId);
    } finally {
      onCancel();
    }
  }

  const bytesReceived = progress?.bytesReceived ?? 0;
  const totalBytes = progress?.totalBytes ?? 0;
  const peerConnected = progress?.peerConnected ?? false;

  const percent =
    totalBytes > 0 ? Math.min(100, Math.round((bytesReceived / totalBytes) * 100)) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e8dcc8]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-[#2a2218] bg-[#111008]">
        <h1 className="text-sm font-medium text-[#c8914a] tracking-wide uppercase">
          Transferring…
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        {/* Peer status */}
        <div className="flex items-center gap-3">
          <span
            className={[
              "w-2 h-2 rounded-full flex-shrink-0",
              peerConnected ? "bg-green-500" : "bg-[#c8914a] animate-pulse",
            ].join(" ")}
          />
          <span className="text-sm text-[#7a6e5f]">
            {peerConnected ? "Peer connected" : "Connecting to peer…"}
          </span>
        </div>

        {/* Progress section */}
        <div className="flex flex-col gap-3">
          <p className="text-xs text-[#4a4035] font-mono truncate">
            Trade ID: {tradeId}
          </p>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-[#2a2218] overflow-hidden">
            <div
              className="h-full bg-[#c8914a] rounded-full transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Byte counter + percentage */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#7a6e5f] font-mono">
              {formatBytes(bytesReceived)} / {formatBytes(totalBytes)}
            </span>
            <span className="text-xs text-[#c8914a] font-mono">{percent}%</span>
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* SHA note */}
        <p className="text-xs text-[#4a4035] text-center">SHA-256 verified on completion</p>

        {/* Cancel */}
        <div className="flex justify-center">
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="text-sm text-[#7a6e5f] hover:text-[#e8dcc8] disabled:opacity-50 transition-colors"
          >
            {cancelling ? "Cancelling…" : "Cancel Transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
