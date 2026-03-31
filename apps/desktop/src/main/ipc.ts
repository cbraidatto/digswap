import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { AuthProvider, SupabaseSession } from "../shared/ipc-types";
import type { DesktopSupabaseAuth } from "./supabase-auth";
import type { DesktopSessionStore } from "./session-store";
import type { DesktopTradeRuntime } from "./trade-runtime";

interface RegisterDesktopIpcOptions {
  authRuntime: DesktopSupabaseAuth;
  sessionStore: DesktopSessionStore;
  tradeRuntime: DesktopTradeRuntime;
}

export function registerDesktopIpc({
  authRuntime,
  sessionStore,
  tradeRuntime,
}: RegisterDesktopIpcOptions) {
  ipcMain.handle("desktop:get-bootstrap-state", async () => ({
    appVersion: app.getVersion(),
    configError: authRuntime.getConfigError(),
    lastProtocolPayload: sessionStore.getLastProtocolPayload(),
    session: await authRuntime.getSession(),
    settings: sessionStore.getSettings(),
    storage: sessionStore.getStorageHealth(),
  }));

  ipcMain.handle("desktop:get-session", () => authRuntime.getSession());

  ipcMain.handle("desktop:open-oauth", (_event, provider: AuthProvider) =>
    authRuntime.startOAuthSignIn(provider),
  );

  ipcMain.handle("desktop:sign-out", async () => {
    await tradeRuntime.releaseAllLeases();
    await authRuntime.signOut();
  });

  ipcMain.handle("desktop:get-pending-trades", () => tradeRuntime.getPendingTrades());

  ipcMain.handle("desktop:open-trade-from-handoff", (_event, handoffToken: string) =>
    tradeRuntime.openTradeFromHandoff(handoffToken),
  );

  ipcMain.handle("desktop:get-settings", () => sessionStore.getSettings());

  ipcMain.handle("desktop:set-settings", (_event, settings) => {
    sessionStore.setSettings(settings);
  });

  ipcMain.handle("desktop:select-download-path", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory", "createDirectory"],
      title: "Choose your DigSwap downloads folder",
      defaultPath: sessionStore.getSettings().downloadPath,
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0] ?? null;
  });

  ipcMain.handle("desktop:get-app-version", () => app.getVersion());

  ipcMain.handle("desktop:get-trade-detail", (_event, tradeId: string) =>
    tradeRuntime.getTradeDetail(tradeId),
  );

  ipcMain.handle("desktop:start-transfer", (_event, tradeId: string) =>
    tradeRuntime.startTransfer(tradeId),
  );

  ipcMain.handle("desktop:cancel-transfer", (_event, tradeId: string) =>
    tradeRuntime.cancelTransfer(tradeId),
  );

  ipcMain.handle("desktop:confirm-completion", (_event, tradeId: string, rating: number) =>
    tradeRuntime.confirmCompletion(tradeId, rating),
  );

  ipcMain.handle("desktop:open-file-in-explorer", (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  authRuntime.onSessionChanged((session: SupabaseSession | null) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop:session-changed", session);
    }
  });

  tradeRuntime.onLobbyStateChanged((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop:lobby-state-changed", event);
    }
  });

  tradeRuntime.onTransferProgress((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop:transfer-progress", event);
    }
  });

  tradeRuntime.onTransferComplete((event) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop:transfer-complete", event);
    }
  });
}
