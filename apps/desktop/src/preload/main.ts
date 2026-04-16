import { contextBridge, ipcRenderer } from "electron";
import type {
  DiffScanResult,
  DesktopMainShellBridge,
  ScanResult,
  ScanProgressEvent,
  SyncResult,
  SyncProgress,
  LibraryTrack,
  EnrichResult,
  EnrichProgressEvent,
  DesktopBridgeLibrary,
} from "../shared/ipc-types";

const desktopShell: DesktopMainShellBridge = {
  isDesktop: () => true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  // SECURITY: syncSession removed — was a session fixation vector (raw tokens from renderer).
  // The handler in main/ipc.ts is disabled and throws; removing from preload prevents
  // any renderer code from even attempting to call it.
  syncHandoffCode: (code: string | null) =>
    ipcRenderer.invoke("desktop-shell:sync-handoff-code", code),
  setAutoStart: (enabled: boolean) =>
    ipcRenderer.invoke("desktop:set-auto-start", enabled) as Promise<void>,
  getAutoStart: () =>
    ipcRenderer.invoke("desktop:get-auto-start") as Promise<boolean>,
  onDiffScanResult: (listener: (result: DiffScanResult) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: DiffScanResult) => listener(data);
    ipcRenderer.on("desktop:diff-scan-result", handler);
    return () => {
      ipcRenderer.removeListener("desktop:diff-scan-result", handler);
    };
  },
};

contextBridge.exposeInMainWorld("desktopShell", desktopShell);

// Library bridge — exposed in main window so /biblioteca web page can access library methods
function subscribe<T>(channel: string, listener: (data: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, data: T) => listener(data);
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
}

const desktopLibrary: DesktopBridgeLibrary = {
  selectLibraryFolder: () =>
    ipcRenderer.invoke("desktop:select-library-folder") as Promise<string | null>,
  startScan: (folderPath: string) =>
    ipcRenderer.invoke("desktop:start-scan", folderPath) as Promise<ScanResult>,
  startIncrementalScan: () =>
    ipcRenderer.invoke("desktop:start-incremental-scan") as Promise<ScanResult>,
  startFullScan: () =>
    ipcRenderer.invoke("desktop:start-full-scan") as Promise<ScanResult>,
  startSync: () =>
    ipcRenderer.invoke("desktop:start-sync") as Promise<SyncResult>,
  getLibraryTracks: () =>
    ipcRenderer.invoke("desktop:get-library-tracks") as Promise<LibraryTrack[]>,
  getLibraryRoot: () =>
    ipcRenderer.invoke("desktop:get-library-root") as Promise<string | null>,
  onScanProgress: (listener: (event: ScanProgressEvent) => void) =>
    subscribe("desktop:scan-progress", listener),
  onSyncProgress: (listener: (event: SyncProgress) => void) =>
    subscribe("desktop:sync-progress", listener),
  enrichMetadata: () =>
    ipcRenderer.invoke("desktop:enrich-metadata") as Promise<EnrichResult>,
  updateTrackField: (trackId: string, field: string, value: string | number | null) =>
    ipcRenderer.invoke("desktop:update-track-field", trackId, field, value) as Promise<void>,
  getGeminiApiKey: () =>
    ipcRenderer.invoke("desktop:get-gemini-api-key") as Promise<string | null>,
  setGeminiApiKey: (apiKey: string) =>
    ipcRenderer.invoke("desktop:set-gemini-api-key", apiKey) as Promise<void>,
  removeGeminiApiKey: () =>
    ipcRenderer.invoke("desktop:remove-gemini-api-key") as Promise<void>,
  onEnrichProgress: (listener: (event: EnrichProgressEvent) => void) =>
    subscribe("desktop:enrich-progress", listener),
};

contextBridge.exposeInMainWorld("desktopLibrary", desktopLibrary);
