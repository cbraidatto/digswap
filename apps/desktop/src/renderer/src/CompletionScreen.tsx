import React, { useState } from "react";
import type { TransferCompleteEvent } from "../shared/ipc-types";

interface Props {
  event: TransferCompleteEvent;
  onDone: () => void;
}

function truncateFilePath(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  if (parts.length <= 2) return filePath;
  return `…/${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
}

export function CompletionScreen({ event, onDone }: Props) {
  const [rating, setRating] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    if (rating === null || confirming) return;
    setConfirming(true);
    try {
      await window.desktopBridge.confirmCompletion(event.tradeId, rating);
    } finally {
      onDone();
    }
  }

  function handleOpenInExplorer() {
    window.desktopBridge.openFileInExplorer(event.filePath);
  }

  const truncatedHash = `${event.sha256.slice(0, 12)}…`;

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e8dcc8] items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col gap-6">
        {/* Success icon */}
        <div className="flex justify-center">
          <span
            className="text-[#c8914a] select-none"
            style={{ fontSize: "48px", lineHeight: 1 }}
          >
            ✓
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-center text-lg font-medium text-[#e8dcc8]">Transfer Complete</h1>

        {/* File path */}
        <div className="flex flex-col gap-2 rounded border border-[#2a2218] bg-[#111008] p-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs text-[#7a6e5f] font-mono truncate" title={event.filePath}>
              {truncateFilePath(event.filePath)}
            </p>
            <button
              type="button"
              onClick={handleOpenInExplorer}
              className="text-xs text-[#c8914a] hover:text-[#e8a85a] transition-colors whitespace-nowrap flex-shrink-0"
            >
              Open in Explorer
            </button>
          </div>
          <p className="text-xs text-[#4a4035] font-mono" title={event.sha256}>
            SHA-256: {truncatedHash}
          </p>
        </div>

        {/* Star rating */}
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[#7a6e5f] text-center">Rate this transfer</p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="text-2xl transition-colors leading-none"
                style={{ color: rating !== null && star <= rating ? "#c8914a" : "#4a4035" }}
                aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
              >
                {rating !== null && star <= rating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>

        {/* Confirm button */}
        <button
          type="button"
          disabled={rating === null || confirming}
          onClick={handleConfirm}
          className={[
            "w-full py-3 rounded text-sm font-medium tracking-wide transition-colors",
            rating !== null && !confirming
              ? "bg-[#c8914a] hover:bg-[#e8a85a] text-[#0d0d0d]"
              : "bg-[#2a2218] text-[#4a4035] cursor-not-allowed opacity-50",
          ].join(" ")}
        >
          {confirming ? "Confirming…" : "Confirm & Close"}
        </button>

        {/* Skip rating */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-[#4a4035] hover:text-[#7a6e5f] transition-colors"
          >
            Skip rating
          </button>
        </div>
      </div>
    </div>
  );
}
