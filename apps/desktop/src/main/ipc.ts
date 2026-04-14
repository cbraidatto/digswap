import { app, dialog, ipcMain, shell } from "electron";
import type { SupabaseSession } from "../shared/ipc-types";
import type { DesktopSupabaseAuth } from "./supabase-auth";
import type { DesktopSessionStore } from "./session-store";
import type { DesktopTradeRuntime } from "./trade-runtime";
import { runAudioUploadPipeline } from "./audio/upload-pipeline";
import { registerLibraryIpc } from "./library/library-ipc";
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

  // SECURITY: Legacy sync-session endpoint removed — accepted raw tokens via IPC
  // which enabled session fixation via XSS. Use sync-handoff-code instead.
  ipcMain.handle("desktop-shell:sync-session", async () => {
    console.warn("[SECURITY] desktop-shell:sync-session is deprecated and disabled. Use sync-handoff-code.");
    throw new Error("sync-session is disabled for security reasons. Use the handoff code flow.");
  });

  // New handoff-code flow: web app sends a single-use code instead of raw tokens.
  // We exchange it server-side so raw tokens never pass through the renderer IPC.
  ipcMain.handle("desktop-shell:sync-handoff-code", async (_event, code: string | null) => {
    if (!code) {
      // null means the web app signed out — clear the desktop session
      await tradeRuntime.releaseAllLeases();
      await authRuntime.clearImportedSession();
      return;
    }

    // Resolve the site URL from the auth config (same source as createMainWindow)
    const siteUrl = (authRuntime as unknown as { config?: { siteUrl?: string } })
      ?.config?.siteUrl ?? "http://localhost:3000";

    let exchangeResult: { userId?: string; error?: string } | null = null;

    try {
      const accessToken = await authRuntime.getAccessToken();
      const res = await fetch(`${siteUrl}/api/desktop/session/exchange`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ code }),
      });

      if (!res.ok) {
        console.error("[desktop-shell:sync-handoff-code] exchange failed:", res.status);
        return;
      }

      exchangeResult = await res.json() as { userId?: string };
    } catch (err) {
      console.error("[desktop-shell:sync-handoff-code] fetch error:", err);
      return;
    }

    if (!exchangeResult?.userId) {
      console.error("[desktop-shell:sync-handoff-code] exchange returned no userId");
      return;
    }

    // The session is already stored in the Supabase client via the cookie in the
    // web app's context. For the desktop's own Supabase client, we refresh it
    // from the vault — the web app's cookie auth and desktop's PKCE auth are
    // independent. The exchange call confirmed the user is authenticated; the
    // desktop session was already set via startOAuthSignIn / handleAuthCallback.
    // Emit the current session to update the renderer if it hasn't heard yet.
    authRuntime.notifySessionListeners();
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

  ipcMain.handle(
    "desktop:select-and-prepare-audio",
    async (_event, tradeId: string, proposalItemId: string) => {
      const result = await dialog.showOpenDialog({
        properties: ["openFile"],
        filters: [
          {
            name: "Audio",
            extensions: ["flac", "wav", "mp3", "aiff", "ogg"],
          },
        ],
        title: "Select an audio file for this trade",
      });

      if (result.canceled || result.filePaths.length === 0) {
        throw new Error("File picker cancelled by user");
      }

      const session = await authRuntime.getSession();
      if (!session) {
        throw new Error("Not authenticated — cannot prepare audio file");
      }

      const client = authRuntime.getClientOrThrow();

      return runAudioUploadPipeline(
        client,
        tradeId,
        session.user.id,
        proposalItemId,
        result.filePaths[0],
      );
    },
  );

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

  // Library IPC handlers (Phase 29)
  registerLibraryIpc(sendToTradeWindow);
}
