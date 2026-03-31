import { app, BrowserWindow, dialog, ipcMain } from "electron";
import type { AuthProvider, DesktopProtocolPayload, SupabaseSession } from "../shared/ipc-types";
import type { DesktopSupabaseAuth } from "./supabase-auth";
import type { DesktopSessionStore } from "./session-store";

interface RegisterDesktopIpcOptions {
  authRuntime: DesktopSupabaseAuth;
  sessionStore: DesktopSessionStore;
}

export function registerDesktopIpc({
  authRuntime,
  sessionStore,
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

  ipcMain.handle("desktop:sign-out", () => authRuntime.signOut());

  ipcMain.handle("desktop:get-pending-trades", async () => []);

  ipcMain.handle("desktop:open-trade-from-handoff", async (_event, handoffToken: string) => {
    throw new Error(
      `Trade runtime handoff activation for token ${handoffToken.slice(0, 6)}... lands in 17-06.`,
    );
  });

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

  authRuntime.setSessionListener((session: SupabaseSession | null) => {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send("desktop:session-changed", session);
    }
  });
}
