import { app, dialog, ipcMain, shell } from "electron";
import type { DesktopShellSessionPayload, SupabaseSession } from "../shared/ipc-types";
import type { DesktopSupabaseAuth } from "./supabase-auth";
import type { DesktopSessionStore } from "./session-store";
import type { DesktopTradeRuntime } from "./trade-runtime";
import { getTradeWindow } from "./window";

interface RegisterDesktopIpcOptions {
  authRuntime: DesktopSupabaseAuth;
  sessionStore: DesktopSessionStore;
  tradeRuntime: DesktopTradeRuntime;
}

function sendToTradeWindow<TPayload>(channel: string, payload: TPayload) {
  const tradeWindow = getTradeWindow();
  if (!tradeWindow || tradeWindow.isDestroyed()) {
    return;
  }

  tradeWindow.webContents.send(channel, payload);
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

  ipcMain.handle("desktop-shell:sync-session", async (_event, session) => {
    const payload = session as DesktopShellSessionPayload | null;

    if (payload) {
      await authRuntime.importSession(payload);
      return;
    }

    await tradeRuntime.releaseAllLeases();
    await authRuntime.clearImportedSession();
  });

  ipcMain.handle("desktop:open-oauth", (_event, provider) => authRuntime.startOAuthSignIn(provider));

  ipcMain.handle("desktop:send-magic-link", (_event, email: string) =>
    authRuntime.startMagicLinkSignIn(email),
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
    sendToTradeWindow("desktop:session-changed", session);
  });

  tradeRuntime.onLobbyStateChanged((event) => {
    sendToTradeWindow("desktop:lobby-state-changed", event);
  });

  tradeRuntime.onTransferProgress((event) => {
    sendToTradeWindow("desktop:transfer-progress", event);
  });

  tradeRuntime.onTransferComplete((event) => {
    sendToTradeWindow("desktop:transfer-complete", event);
  });
}
