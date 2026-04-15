import { ipcMain, dialog } from "electron";
import type { ScanProgressEvent, ScanResult, SyncResult, SyncProgress, LibraryTrack, EnrichProgressEvent, EnrichResult } from "../../shared/ipc-types";
import { getLibraryDb, getAllTracks, getLibraryRoot, getQualifyingTracks, updateTrackField, trackRowToLibraryTrack } from "./db";
import { enrichTracks } from "./ai-enrichment";
import { scanFolder } from "./scanner";
import { startSync } from "./sync-manager";
import { restartWatching } from "../watcher";
import type { DesktopSupabaseAuth } from "../supabase-auth";
import type { DesktopSessionStore } from "../session-store";

export function registerLibraryIpc(
  sendToMainWindow: <T>(channel: string, payload: T) => void,
  getAuth?: () => DesktopSupabaseAuth,
  getSiteUrl?: () => string,
  getSessionStore?: () => DesktopSessionStore,
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
    return getAllTracks(db).map(trackRowToLibraryTrack);
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

  // ─────────────────────────────────────────────────────────────────────────────
  // AI Enrichment (Phase 32)
  // ─────────────────────────────────────────────────────────────────────────────

  ipcMain.handle("desktop:enrich-metadata", async (): Promise<EnrichResult> => {
    const db = getLibraryDb();
    const qualifying = getQualifyingTracks(db);
    if (qualifying.length === 0) {
      return { total: 0, enriched: 0, errors: [] };
    }
    const sessionStore = getSessionStore?.();
    if (!sessionStore) {
      return { total: 0, enriched: 0, errors: ["Session store not configured"] };
    }
    const apiKey = await sessionStore.getVaultItem("gemini_api_key");
    if (!apiKey) {
      return { total: 0, enriched: 0, errors: ["Gemini API key not configured"] };
    }
    return enrichTracks(db, qualifying, apiKey, (progress: EnrichProgressEvent) => {
      sendToMainWindow("desktop:enrich-progress", progress);
    });
  });

  ipcMain.handle(
    "desktop:update-track-field",
    async (
      _event: unknown,
      trackId: string,
      field: string,
      value: string | number | null,
    ): Promise<void> => {
      const db = getLibraryDb();
      updateTrackField(db, trackId, field as "artist" | "album" | "title" | "year" | "trackNumber", value);
    },
  );

  ipcMain.handle("desktop:get-gemini-api-key", async (): Promise<string | null> => {
    const sessionStore = getSessionStore?.();
    if (!sessionStore) return null;
    return sessionStore.getVaultItem("gemini_api_key");
  });

  ipcMain.handle("desktop:set-gemini-api-key", async (_event: unknown, apiKey: string): Promise<void> => {
    const sessionStore = getSessionStore?.();
    if (!sessionStore) return;
    await sessionStore.setVaultItem("gemini_api_key", apiKey);
  });

  ipcMain.handle("desktop:remove-gemini-api-key", async (): Promise<void> => {
    const sessionStore = getSessionStore?.();
    if (!sessionStore) return;
    await sessionStore.removeVaultItem("gemini_api_key");
  });
}
