import { contextBridge, ipcRenderer } from "electron";
import type {
  DesktopMainShellBridge,
  LibraryTrack,
  ScanProgressEvent,
  ScanResult,
  SyncResult,
  SyncProgress,
} from "../shared/ipc-types";

const desktopShell: DesktopMainShellBridge = {
  isDesktop: () => true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  syncHandoffCode: (code: string | null) =>
    ipcRenderer.invoke("desktop-shell:sync-handoff-code", code),
  openLibrary: () => ipcRenderer.invoke("desktop:open-library") as Promise<void>,

  // Library methods — used by /biblioteca page in the web app
  selectLibraryFolder: () =>
    ipcRenderer.invoke("desktop:select-library-folder") as Promise<string | null>,
  startScan: (folderPath: string, mode: "incremental" | "full") =>
    ipcRenderer.invoke("desktop:start-scan", folderPath, mode) as Promise<ScanResult>,
  getLibraryTracks: () =>
    ipcRenderer.invoke("desktop:get-library-tracks") as Promise<LibraryTrack[]>,
  getLibraryRoot: () =>
    ipcRenderer.invoke("desktop:get-library-root") as Promise<string | null>,
  onScanProgress: (listener: (event: ScanProgressEvent) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ScanProgressEvent) => listener(data);
    ipcRenderer.on("desktop:scan-progress", handler);
    return () => { ipcRenderer.removeListener("desktop:scan-progress", handler); };
  },
  startSync: () =>
    ipcRenderer.invoke("desktop:start-sync") as Promise<SyncResult>,
  onSyncProgress: (listener: (event: SyncProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: SyncProgress) => listener(data);
    ipcRenderer.on("desktop:sync-progress", handler);
    return () => { ipcRenderer.removeListener("desktop:sync-progress", handler); };
  },
};

contextBridge.exposeInMainWorld("desktopShell", desktopShell);
