import React, { useState } from "react";
import type { AudioPrepResult } from "../../shared/ipc-types";
import { SpectralVisualizer } from "./SpectralVisualizer";

interface ProposalItem {
  id: string;
  title: string;
  artist: string;
}

interface Props {
  tradeId: string;
  proposalItems: ProposalItem[];
  onComplete: (results: AudioPrepResult[]) => void;
  onCancel: () => void;
}

type ItemState = "idle" | "preparing" | "done" | "error";

/** Maps AudioPipelineError codes to user-friendly messages */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("FILE_TOO_SHORT")) {
      return "File must be at least 2 minutes long";
    }
    if (msg.includes("FFMPEG_FAILED") || msg.includes("PROBE_FAILED")) {
      return "Could not read audio file — check format";
    }
    if (msg.includes("network") || msg.includes("upload") || msg.includes("fetch")) {
      return "Upload failed, check connection";
    }
    if (msg.includes("cancel") || msg.includes("Cancel")) {
      return "";
    }
    return msg;
  }
  return "An unexpected error occurred";
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatBitrate(kbps: number): string {
  return `${kbps} kbps`;
}

function formatSampleRate(hz: number): string {
  return `${(hz / 1000).toFixed(1)} kHz`;
}

function StatusIndicator({ state }: { state: ItemState }) {
  switch (state) {
    case "idle":
      return (
        <span className="w-2 h-2 rounded-full bg-[#4a4035] flex-shrink-0" />
      );
    case "preparing":
      return (
        <span className="w-2 h-2 rounded-full bg-[#c8914a] animate-pulse flex-shrink-0" />
      );
    case "done":
      return (
        <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
      );
    case "error":
      return (
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
      );
  }
}

export function AudioPrepScreen({ tradeId, proposalItems, onComplete, onCancel }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<AudioPrepResult[]>([]);
  const [itemState, setItemState] = useState<ItemState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSelectAndUpload() {
    if (itemState === "preparing") return;

    const currentItem = proposalItems[currentIndex];
    setItemState("preparing");
    setErrorMessage(null);

    try {
      const result = await window.desktopBridge.selectAndPrepareAudio(
        tradeId,
        currentItem.id
      );

      const newResults = [...results, result];
      setResults(newResults);
      setItemState("done");

      // Advance to next item or complete
      const nextIndex = currentIndex + 1;
      if (nextIndex >= proposalItems.length) {
        // All items done
        onComplete(newResults);
      } else {
        // Small delay before moving to next item for visual feedback
        setTimeout(() => {
          setCurrentIndex(nextIndex);
          setItemState("idle");
        }, 800);
      }
    } catch (error) {
      const msg = getErrorMessage(error);
      // User cancelled the file picker — reset to idle silently
      if (!msg) {
        setItemState("idle");
        return;
      }
      setItemState("error");
      setErrorMessage(msg);
    }
  }

  function handleRetry() {
    setItemState("idle");
    setErrorMessage(null);
  }

  const currentItem = proposalItems[currentIndex];
  const completedCount = results.length;
  const totalCount = proposalItems.length;

  return (
    <div className="flex flex-col h-full bg-[#0d0d0d] text-[#e8dcc8]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2218] bg-[#111008]">
        <button
          type="button"
          onClick={onCancel}
          className="text-[#7a6e5f] hover:text-[#e8dcc8] text-sm transition-colors"
        >
          &larr; Back
        </button>
        <h1 className="text-sm font-medium text-[#e8dcc8]">
          Upload Audio Files
        </h1>
        <span className="ml-auto text-xs text-[#4a4035] font-mono">
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {/* Progress overview */}
        <div className="w-full h-1 rounded-full bg-[#2a2218] overflow-hidden">
          <div
            className="h-full bg-[#c8914a] rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        </div>

        {/* Item list */}
        <div className="flex flex-col gap-2">
          {proposalItems.map((item, index) => {
            let state: ItemState = "idle";
            if (index < currentIndex || (index === currentIndex && itemState === "done")) {
              state = "done";
            } else if (index === currentIndex) {
              state = itemState;
            }

            const result = results[index];

            return (
              <div key={item.id}>
                <div
                  className={[
                    "flex items-center gap-3 rounded border px-4 py-3",
                    index === currentIndex
                      ? "border-[#c8914a] bg-[#111008]"
                      : "border-[#2a2218] bg-[#111008]",
                  ].join(" ")}
                >
                  <StatusIndicator state={state} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#e8dcc8] truncate">{item.title}</p>
                    {item.artist && (
                      <p className="text-xs text-[#7a6e5f] truncate">{item.artist}</p>
                    )}
                  </div>
                  <span className="text-xs text-[#4a4035] font-mono flex-shrink-0">
                    {state === "done"
                      ? "Done"
                      : state === "preparing"
                        ? "Uploading..."
                        : state === "error"
                          ? "Failed"
                          : index === currentIndex
                            ? "Ready"
                            : "Pending"}
                  </span>
                </div>

                {/* Show specs summary for completed items */}
                {state === "done" && result && (
                  <div className="ml-5 mt-1 mb-2 flex flex-col gap-2">
                    <div className="flex items-center gap-3 text-xs text-[#7a6e5f] font-mono">
                      <span>{result.specs.format.toUpperCase()}</span>
                      <span>{formatBitrate(result.specs.bitrate)}</span>
                      <span>{formatSampleRate(result.specs.sampleRate)}</span>
                      <span>{formatDuration(result.specs.duration)}</span>
                    </div>
                    <p className="text-xs text-[#4a4035] italic">
                      Preview generated — SHA-256: {result.sha256.substring(0, 12)}...
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="rounded border border-red-900/50 bg-red-950/30 px-4 py-3">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="text-xs text-[#c8914a] hover:text-[#e8a85a] mt-2 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Current item action */}
        {itemState !== "done" && currentIndex < proposalItems.length && (
          <button
            type="button"
            disabled={itemState === "preparing"}
            onClick={handleSelectAndUpload}
            className={[
              "w-full py-3 rounded text-sm font-medium tracking-wide transition-colors",
              itemState !== "preparing"
                ? "bg-[#c8914a] hover:bg-[#e8a85a] text-[#0d0d0d]"
                : "bg-[#2a2218] text-[#4a4035] cursor-not-allowed opacity-50",
            ].join(" ")}
          >
            {itemState === "preparing"
              ? "Preparing..."
              : `Select & Upload ${currentItem.title}`}
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Cancel */}
        <div className="flex justify-center">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-[#7a6e5f] hover:text-[#e8dcc8] transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
