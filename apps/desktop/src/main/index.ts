import { app, BrowserWindow, Notification } from "electron";
import type { DesktopProtocolPayload } from "../shared/ipc-types";
import { resolveDesktopSupabaseConfig } from "./config";
import { runDiffScan } from "./diff-scan";
import { registerDesktopIpc } from "./ipc";
import { closeLibraryDb, getLibraryDb, getLibraryRoot } from "./library/db";
import { scanFolder } from "./library/scanner";
import { startSync } from "./library/sync-manager";
import { extractProtocolUrlFromArgv, parseProtocolUrl, registerProtocolClient } from "./protocol";
import { DesktopSessionStore } from "./session-store";
import { DesktopSupabaseAuth } from "./supabase-auth";
import { DesktopTradeRuntime } from "./trade-runtime";
import { createTray, destroyTray } from "./tray";
import { startWatching, stopWatching } from "./watcher";
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

async function runWatcherScanAndSync(): Promise<void> {
  try {
    const db = getLibraryDb();
    const rootPath = getLibraryRoot(db);
    if (!rootPath) return;

    // Run incremental scan
    await scanFolder(rootPath, (progress) => {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send("desktop:scan-progress", progress);
      }
    }, { incremental: true });

    // Auto-sync after scan
    if (!authRuntime) return;
    const siteUrl = desktopSiteUrl;
    await startSync(db, siteUrl, () => authRuntime!.getAccessToken(), (progress) => {
      const mainWin = getMainWindow();
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send("desktop:sync-progress", progress);
      }
    });
  } catch (err) {
    console.error("[watcher] scan+sync error:", err);
  }
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

  // Start watcher and diff scan if library root is configured
  try {
    const db = getLibraryDb();
    const rootPath = getLibraryRoot(db);
    if (rootPath) {
      // Start file watcher
      startWatching(rootPath, () => {
        void runWatcherScanAndSync();
      });

      // Run diff scan on startup (background)
      void (async () => {
        const result = await runDiffScan(db);
        const mainWin = getMainWindow();
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send("desktop:diff-scan-result", result);
        }
        // If window is hidden (boot-to-tray), show native notification
        if (result.hasChanges && mainWin && !mainWin.isVisible()) {
          new Notification({
            title: "DigSwap",
            body: `Found ${result.added} new, ${result.removed} removed, ${result.modified} modified files`,
          }).show();
        }
        // Large library warning (per D-04)
        if (result.totalIndexed > 10000) {
          const mainWin2 = getMainWindow();
          if (mainWin2 && !mainWin2.isDestroyed()) {
            mainWin2.webContents.send("desktop:large-library-warning", {
              count: result.totalIndexed,
              message: `Your library has ${result.totalIndexed} files. Watching large folders may use more system resources.`,
            });
          }
        }
        // Auto-sync if changes found (per D-06)
        if (result.hasChanges) {
          await runWatcherScanAndSync();
        }
      })();
    }
  } catch (err) {
    console.error("[startup] watcher/diff-scan init error:", err);
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
  stopWatching(); // Stop watcher first (prevents scan trigger during shutdown)
  destroyTray();
  closeLibraryDb();

  if (!tradeRuntime) {
    return;
  }

  void tradeRuntime.shutdown();
});

app.on("window-all-closed", () => {
  // Intentionally empty -- app runs in tray when window is closed/hidden
});
