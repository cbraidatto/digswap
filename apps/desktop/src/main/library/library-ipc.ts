import { ipcMain, dialog } from "electron";
import type { ScanProgressEvent, ScanResult, LibraryTrack } from "../../shared/ipc-types";
import { getLibraryDb, getAllTracks, getLibraryRoot, closeLibraryDb } from "./db";
import { scanFolder } from "./scanner";

export function registerLibraryIpc(
  sendToMainWindow: <T>(channel: string, payload: T) => void,
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
    return scanFolder(folderPath, (progress: ScanProgressEvent) => {
      sendToMainWindow("desktop:scan-progress", progress);
    }, { incremental: mode === "incremental" });
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
}
