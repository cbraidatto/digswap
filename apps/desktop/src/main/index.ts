import { app, BrowserWindow } from "electron";
import type { DesktopProtocolPayload } from "../shared/ipc-types";
import { resolveDesktopSupabaseConfig } from "./config";
import { registerDesktopIpc } from "./ipc";
import { extractProtocolUrlFromArgv, parseProtocolUrl, registerProtocolClient } from "./protocol";
import { DesktopSessionStore } from "./session-store";
import { DesktopSupabaseAuth } from "./supabase-auth";
import { DesktopTradeRuntime } from "./trade-runtime";
import { createTray, destroyTray } from "./tray";
import {
  createMainWindow,
  createTradeWindow,
  focusMainWindow,
  focusTradeWindow,
  getMainWindow,
  setIsQuitting,
} from "./window";

// Allow a second dev instance via DIGSWAP_SECOND_INSTANCE=1.
// The second instance gets its own userData path so sessions and stores
// are fully isolated from the first instance.
const isSecondInstance = process.env.DIGSWAP_SECOND_INSTANCE === "1";

if (isSecondInstance) {
  const path = require("node:path") as typeof import("node:path");
  app.setPath("userData", path.join(app.getPath("userData"), "-second"));
}

const gotLock = isSecondInstance || app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
}

app.setAppUserModelId("com.digswap.desktop");

const isBootToTray = process.argv.includes("--boot-to-tray");
const queuedProtocolUrls: string[] = [];
let sessionStore: DesktopSessionStore | null = null;
let authRuntime: DesktopSupabaseAuth | null = null;
let tradeRuntime: DesktopTradeRuntime | null = null;
let desktopSiteUrl = "http://localhost:3000";
let desktopSupabaseUrl: string | null = null;

function resolveDesktopSiteUrl() {
  return (
    process.env.DESKTOP_WEB_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

async function publishProtocolPayload(payload: DesktopProtocolPayload) {
  sessionStore?.setLastProtocolPayload(payload);

  if (payload.kind === "trade-handoff") {
    const tradeWindow = await createTradeWindow();
    tradeWindow.webContents.send("desktop:protocol-payload", payload);
    focusTradeWindow();
    return;
  }

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

  await publishProtocolPayload(payload);
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
  const protocolUrl = extractProtocolUrlFromArgv(argv);
  if (!protocolUrl) {
    focusMainWindow();
    return;
  }

  enqueueProtocolUrl(protocolUrl);
});

app.on("open-url", (event, rawUrl) => {
  event.preventDefault();
  enqueueProtocolUrl(rawUrl);
});

app.whenReady().then(async () => {
  registerProtocolClient();

  sessionStore = new DesktopSessionStore();

  const { config, error } = resolveDesktopSupabaseConfig();
  desktopSiteUrl = config?.siteUrl ?? resolveDesktopSiteUrl();
  desktopSupabaseUrl = config?.url ?? null;

  authRuntime = new DesktopSupabaseAuth(config, error, sessionStore);
  tradeRuntime = new DesktopTradeRuntime(config, authRuntime, sessionStore);
  await tradeRuntime.initialize();

  registerDesktopIpc({
    authRuntime,
    sessionStore,
    tradeRuntime,
  });

  createTray();

  await createMainWindow(
    { siteUrl: desktopSiteUrl, supabaseUrl: desktopSupabaseUrl },
    { bootToTray: isBootToTray },
  );

  const startupProtocolUrl = extractProtocolUrlFromArgv(process.argv);
  if (startupProtocolUrl) {
    queuedProtocolUrls.push(startupProtocolUrl);
  }

  for (const queuedProtocolUrl of queuedProtocolUrls.splice(0)) {
    await processProtocolUrl(queuedProtocolUrl);
  }

  app.on("activate", async () => {
    const mainWin = getMainWindow();
    if (mainWin && !mainWin.isDestroyed()) {
      focusMainWindow();
      return;
    }

    await createMainWindow({
      siteUrl: desktopSiteUrl,
      supabaseUrl: desktopSupabaseUrl,
    });
  });
});

app.on("before-quit", () => {
  setIsQuitting(true);
  destroyTray();

  if (!tradeRuntime) {
    return;
  }

  void tradeRuntime.shutdown();
});

app.on("window-all-closed", () => {
  // Intentionally empty -- app runs in tray when window is closed/hidden
});
