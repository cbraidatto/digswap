import { app, BrowserWindow } from "electron";
import type { DesktopProtocolPayload } from "../shared/ipc-types";
import { registerDesktopIpc } from "./ipc";
import { resolveDesktopSupabaseConfig } from "./config";
import { extractProtocolUrlFromArgv, parseProtocolUrl, registerProtocolClient } from "./protocol";
import { DesktopSessionStore } from "./session-store";
import { DesktopSupabaseAuth } from "./supabase-auth";
import { DesktopTradeRuntime } from "./trade-runtime";
import { createMainWindow, getMainWindow } from "./window";

const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
}

app.setAppUserModelId("com.digswap.desktop");

const queuedProtocolUrls: string[] = [];
let sessionStore: DesktopSessionStore | null = null;
let authRuntime: DesktopSupabaseAuth | null = null;
let tradeRuntime: DesktopTradeRuntime | null = null;

function focusMainWindow() {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function publishProtocolPayload(payload: DesktopProtocolPayload) {
  sessionStore?.setLastProtocolPayload(payload);

  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }

  mainWindow.webContents.send("desktop:protocol-payload", payload);
  focusMainWindow();
}

async function processProtocolUrl(rawUrl: string) {
  const payload = parseProtocolUrl(rawUrl);

  if (!payload) {
    return;
  }

  if (payload.kind === "auth-callback" && authRuntime) {
    await authRuntime.handleAuthCallback(payload);
  }

  publishProtocolPayload(payload);
}

function enqueueProtocolUrl(rawUrl: string | null) {
  if (!rawUrl) {
    return;
  }

  if (!authRuntime || !sessionStore || !app.isReady()) {
    queuedProtocolUrls.push(rawUrl);
    return;
  }

  void processProtocolUrl(rawUrl);
}

app.on("second-instance", (_event, argv) => {
  enqueueProtocolUrl(extractProtocolUrlFromArgv(argv));
  focusMainWindow();
});

app.on("open-url", (event, rawUrl) => {
  event.preventDefault();
  enqueueProtocolUrl(rawUrl);
});

app.whenReady().then(async () => {
  registerProtocolClient();

  sessionStore = new DesktopSessionStore();

  const { config, error } = resolveDesktopSupabaseConfig();
  authRuntime = new DesktopSupabaseAuth(config, error, sessionStore);
  tradeRuntime = new DesktopTradeRuntime(config, authRuntime, sessionStore);
  await tradeRuntime.initialize();

  registerDesktopIpc({
    authRuntime,
    sessionStore,
    tradeRuntime,
  });

  await createMainWindow();

  const startupProtocolUrl = extractProtocolUrlFromArgv(process.argv);
  if (startupProtocolUrl) {
    queuedProtocolUrls.push(startupProtocolUrl);
  }

  for (const queuedProtocolUrl of queuedProtocolUrls.splice(0)) {
    void processProtocolUrl(queuedProtocolUrl);
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
      return;
    }

    focusMainWindow();
  });
});

app.on("before-quit", () => {
  if (!tradeRuntime) {
    return;
  }

  void tradeRuntime.shutdown();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
