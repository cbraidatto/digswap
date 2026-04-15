import { ipcMain, dialog } from "electron";
import type { ScanProgressEvent, ScanResult, SyncResult, SyncProgress, LibraryTrack } from "../../shared/ipc-types";
import { getLibraryDb, getAllTracks, getLibraryRoot } from "./db";
import { scanFolder } from "./scanner";
import { startSync } from "./sync-manager";
import { restartWatching } from "../watcher";
import type { DesktopSupabaseAuth } from "../supabase-auth";

export function registerLibraryIpc(
  sendToMainWindow: <T>(channel: string, payload: T) => void,
  getAuth?: () => DesktopSupabaseAuth,
  getSiteUrl?: () => string,
): void {
  ipcMain.handle("desktop:select-library-folder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
      title: "Selecionar pasta da biblioteca",
    });
    if (result.canceled) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("desktop:start-scan", async (_event, folderPath: string, mode: "incremental" | "full"): Promise<ScanResult> => {
    const result = await scanFolder(folderPath, (progress: ScanProgressEvent) => {
      sendToMainWindow("desktop:scan-progress", progress);
    }, { incremental: mode === "incremental" });

    // Restart watcher on the (possibly new) library folder
    restartWatching(folderPath);

    return result;
  });

  ipcMain.handle("desktop:start-incremental-scan", async (): Promise<ScanResult> => {
    const db = getLibraryDb();
    const rootPath = getLibraryRoot(db);
    if (!rootPath) {
      return { filesFound: 0, filesProcessed: 0, errors: [{ filePath: "", reason: "No library root configured" }] };
    }
    return scanFolder(rootPath, (progress: ScanProgressEvent) => {
      sendToMainWindow("desktop:scan-progress", progress);
    }, { incremental: true });
  });

  ipcMain.handle("desktop:start-full-scan", async (): Promise<ScanResult> => {
    const db = getLibraryDb();
    const rootPath = getLibraryRoot(db);
    if (!rootPath) {
      return { filesFound: 0, filesProcessed: 0, errors: [{ filePath: "", reason: "No library root configured" }] };
    }
    return scanFolder(rootPath, (progress: ScanProgressEvent) => {
      sendToMainWindow("desktop:scan-progress", progress);
    }, { incremental: false });
  });

  ipcMain.handle("desktop:get-library-tracks", (): LibraryTrack[] => {
    const db = getLibraryDb();
    return getAllTracks(db) as LibraryTrack[];
  });

  ipcMain.handle("desktop:get-library-root", (): string | null => {
    const db = getLibraryDb();
    return getLibraryRoot(db);
  });

  ipcMain.handle("desktop:start-sync", async (): Promise<SyncResult> => {
    const db = getLibraryDb();
    const auth = getAuth?.();
    const siteUrl = getSiteUrl?.() ?? "http://localhost:3000";

    if (!auth) {
      return { synced: 0, created: 0, linked: 0, deleted: 0, errors: ["Auth not configured"] };
    }

    return startSync(
      db,
      siteUrl,
      () => auth.getAccessToken(),
      (progress: SyncProgress) => {
        sendToMainWindow("desktop:sync-progress", progress);
      },
    );
  });
}
