import React, { useCallback, useEffect, useState } from "react";
import type { LibraryTrack, ScanProgressEvent, ScanResult } from "../../shared/ipc-types";
import { LibraryListView } from "./LibraryListView";
import { LibraryAlbumView } from "./LibraryAlbumView";

type ScreenState = "empty" | "scanning" | "error-summary" | "library";

export function LibraryScreen() {
  const [screenState, setScreenState] = useState<ScreenState>("empty");
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [scanProgress, setScanProgress] = useState<ScanProgressEvent | null>(null);
  const [scanErrors, setScanErrors] = useState<Array<{ filePath: string; reason: string }>>([]);
  const [viewMode, setViewMode] = useState<"list" | "album">("list");
  const [libraryRoot, setLibraryRoot] = useState<string | null>(null);

  // Check for existing library on mount
  useEffect(() => {
    window.desktopBridge.getLibraryRoot().then((root) => {
      if (root) {
        setLibraryRoot(root);
        window.desktopBridge.getLibraryTracks().then((loadedTracks) => {
          setTracks(loadedTracks);
          setScreenState("library");
        });
      }
    });
  }, []);

  // Subscribe to scan progress events
  useEffect(() => {
    const unsub = window.desktopBridge.onScanProgress((event: ScanProgressEvent) => {
      setScanProgress(event);
    });
    return unsub;
  }, []);

  const handleScanComplete = useCallback((result: ScanResult) => {
    if (result.errors.length > 0) {
      setScanErrors(result.errors);
      setScreenState("error-summary");
    } else {
      window.desktopBridge.getLibraryTracks().then((loadedTracks) => {
        setTracks(loadedTracks);
        setScreenState("library");
      });
    }
  }, []);

  const handleSelectFolder = useCallback(async () => {
    const folderPath = await window.desktopBridge.selectLibraryFolder();
    if (!folderPath) return;
    setLibraryRoot(folderPath);
    setScreenState("scanning");
    setScanProgress(null);
    const result = await window.desktopBridge.startScan(folderPath);
    handleScanComplete(result);
  }, [handleScanComplete]);

  const handleRescan = useCallback(async () => {
    setScreenState("scanning");
    setScanProgress(null);
    const result = await window.desktopBridge.startIncrementalScan();
    handleScanComplete(result);
  }, [handleScanComplete]);

  const handleFullRescan = useCallback(async () => {
    setScreenState("scanning");
    setScanProgress(null);
    const result = await window.desktopBridge.startFullScan();
    handleScanComplete(result);
  }, [handleScanComplete]);

  const handleDismissErrors = useCallback(() => {
    window.desktopBridge.getLibraryTracks().then((loadedTracks) => {
      setTracks(loadedTracks);
      setScreenState("library");
    });
  }, []);

  // ── Empty state ──
  if (screenState === "empty") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        {/* Folder icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#4a4035"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>

        <h1 className="text-xl font-semibold text-[#e8dcc8]">Minha Biblioteca</h1>

        <p className="text-sm text-[#7a6e5f] max-w-[320px] text-center">
          Selecione uma pasta para escanear sua biblioteca de musica
        </p>

        <button
          type="button"
          onClick={handleSelectFolder}
          className="bg-[#c8914a] text-[#0d0d0d] px-8 py-3 rounded-lg font-semibold text-sm hover:brightness-110 transition-all"
        >
          Escolher Pasta
        </button>

        <span className="text-xs text-[#4a4035] mt-4">FLAC, WAV, AIFF</span>
      </div>
    );
  }

  // ── Scanning state ──
  if (screenState === "scanning") {
    const progress = scanProgress;
    const pct =
      progress && progress.filesFound > 0
        ? Math.round((progress.filesProcessed / progress.filesFound) * 100)
        : 0;

    // Truncate path from left if too long
    const displayPath = progress?.currentPath
      ? progress.currentPath.length > 60
        ? `...${progress.currentPath.slice(-57)}`
        : progress.currentPath
      : "";

    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8914a]">
          Escaneando...
        </span>

        {/* Progress bar */}
        <div className="w-full max-w-md h-2 rounded-full bg-[#1a1508]">
          <div
            className="h-2 rounded-full bg-[#c8914a] transition-all duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Counter */}
        <span className="text-sm font-mono text-[#e8dcc8]">
          {progress?.filesProcessed ?? 0} / {progress?.filesFound ?? 0} arquivos
        </span>

        {/* File ticker */}
        <span className="text-xs font-mono text-[#4a4035] max-w-lg overflow-hidden text-ellipsis whitespace-nowrap">
          {displayPath}
        </span>

        {/* Error counter */}
        {progress && progress.errorCount > 0 && (
          <span className="text-xs text-[#e85c5c]">{progress.errorCount} erros</span>
        )}
      </div>
    );
  }

  // ── Error summary state ──
  if (screenState === "error-summary") {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="rounded border border-[#6b3940] bg-[#241419]/90 p-4 w-full max-w-2xl">
          <h2 className="text-sm font-semibold text-[#ffcfd7] mb-3">
            {scanErrors.length} arquivos ignorados
          </h2>

          <div className="max-h-40 overflow-auto space-y-1">
            {scanErrors.map((err, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-xs font-mono text-[#7a6e5f] truncate">
                  {err.filePath}
                </span>
                <span className="text-xs text-[#e85c5c]">{err.reason}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end mt-3">
            <button
              type="button"
              onClick={handleDismissErrors}
              className="text-sm font-medium text-[#e8dcc8] hover:text-white transition-colors"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Library state ──
  return (
    <div className="flex flex-col h-full">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2218] bg-[#111008] shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[#e8dcc8]">Minha Biblioteca</span>
          <span className="text-xs text-[#7a6e5f]">{tracks.length} arquivos</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRescan}
            className="text-xs text-[#7a6e5f] hover:text-[#e8dcc8] transition-colors"
          >
            Re-scan
          </button>
          <button
            type="button"
            onClick={handleFullRescan}
            className="text-xs text-[#7a6e5f] hover:text-[#c8914a] transition-colors"
          >
            Re-scan Completo
          </button>

          {/* View toggle */}
          <div className="flex items-center gap-1">
            {/* List view icon */}
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                viewMode === "list"
                  ? "bg-[#1a1508] text-[#c8914a]"
                  : "text-[#4a4035] hover:text-[#7a6e5f]"
              }`}
              title="Lista"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="2" y1="4" x2="14" y2="4" />
                <line x1="2" y1="8" x2="14" y2="8" />
                <line x1="2" y1="12" x2="14" y2="12" />
              </svg>
            </button>

            {/* Album view icon */}
            <button
              type="button"
              onClick={() => setViewMode("album")}
              className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${
                viewMode === "album"
                  ? "bg-[#1a1508] text-[#c8914a]"
                  : "text-[#4a4035] hover:text-[#7a6e5f]"
              }`}
              title="Albums"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="5" height="5" rx="1" />
                <rect x="9" y="2" width="5" height="5" rx="1" />
                <rect x="2" y="9" width="5" height="5" rx="1" />
                <rect x="9" y="9" width="5" height="5" rx="1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === "list" ? (
        <LibraryListView tracks={tracks} />
      ) : (
        <LibraryAlbumView tracks={tracks} />
      )}
    </div>
  );
}
