import path from "node:path";
import { BrowserWindow, shell, type WebContents } from "electron";

const TRUSTED_AUTH_ORIGINS = [
  "https://accounts.google.com",
  "https://github.com",
  "https://www.discogs.com",
  "https://discogs.com",
] as const;

export interface MainWindowConfig {
  siteUrl: string;
  supabaseUrl?: string | null;
}

let mainWindow: BrowserWindow | null = null;
let tradeWindow: BrowserWindow | null = null;
let isQuitting = false;

export function setIsQuitting(value: boolean): void {
  isQuitting = value;
}

function resolvePreloadPath(name: "main" | "trade") {
  return path.join(__dirname, `../preload/${name}.js`);
}

function resolveTradeRendererFilePath() {
  return path.join(__dirname, "../renderer/renderer-trade/index.html");
}

function resolveAllowedMainWindowOrigins(config: MainWindowConfig) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(config.siteUrl).origin);
  } catch {
    // Ignore invalid site URLs and keep the hard-coded auth origins only.
  }

  if (config.supabaseUrl) {
    try {
      origins.add(new URL(config.supabaseUrl).origin);
    } catch {
      // Ignore invalid Supabase URLs.
    }
  }

  for (const origin of TRUSTED_AUTH_ORIGINS) {
    origins.add(origin);
  }

  return origins;
}

function isHttpUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isAllowedMainWindowUrl(url: string, allowedOrigins: Set<string>) {
  if (url === "about:blank") {
    return true;
  }

  try {
    const parsed = new URL(url);
    return allowedOrigins.has(parsed.origin);
  } catch {
    return false;
  }
}

function focusWindow(window: BrowserWindow | null) {
  if (!window || window.isDestroyed()) {
    return;
  }

  if (window.isMinimized()) {
    window.restore();
  }

  window.show();
  window.focus();
}

function lockDownMainWindowNavigation(window: BrowserWindow, config: MainWindowConfig) {
  const allowedOrigins = resolveAllowedMainWindowOrigins(config);
  const shouldAllow = (url: string) => isAllowedMainWindowUrl(url, allowedOrigins);

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });

  window.webContents.on("will-navigate", (event, url) => {
    if (shouldAllow(url)) {
      return;
    }

    event.preventDefault();

    if (isHttpUrl(url) || url.startsWith("digswap://")) {
      void shell.openExternal(url);
    }
  });

  window.webContents.on("will-redirect", (event, url) => {
    if (shouldAllow(url)) {
      return;
    }

    event.preventDefault();

    if (isHttpUrl(url) || url.startsWith("digswap://")) {
      void shell.openExternal(url);
    }
  });

  window.webContents.session.setPermissionRequestHandler(
    (webContents: WebContents, _permission, callback) => {
      callback(webContents.id === window.webContents.id ? false : false);
    },
  );
}

export interface MainWindowOptions {
  bootToTray?: boolean;
}

export async function createMainWindow(
  config: MainWindowConfig,
  options?: MainWindowOptions,
) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    title: "DigSwap Desktop",
    backgroundColor: "#0b0907",
    webPreferences: {
      preload: resolvePreloadPath("main"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  lockDownMainWindowNavigation(mainWindow, config);

  if (!options?.bootToTray) {
    mainWindow.once("ready-to-show", () => {
      mainWindow?.show();
    });
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(config.siteUrl);

  return mainWindow;
}

export async function createTradeWindow() {
  if (tradeWindow && !tradeWindow.isDestroyed()) {
    return tradeWindow;
  }

  tradeWindow = new BrowserWindow({
    width: 600,
    height: 700,
    minWidth: 520,
    minHeight: 620,
    show: false,
    title: "DigSwap Trade",
    backgroundColor: "#0b0907",
    autoHideMenuBar: true,
    webPreferences: {
      preload: resolvePreloadPath("trade"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  tradeWindow.once("ready-to-show", () => {
    tradeWindow?.show();
  });

  tradeWindow.on("closed", () => {
    tradeWindow = null;
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    const base = process.env.ELECTRON_RENDERER_URL.replace(/\/$/, "");
    await tradeWindow.loadURL(`${base}/renderer-trade/index.html`);
  } else {
    await tradeWindow.loadFile(resolveTradeRendererFilePath());
  }

  return tradeWindow;
}

export function getMainWindow() {
  return mainWindow;
}

export function getTradeWindow() {
  return tradeWindow;
}

export function focusMainWindow() {
  focusWindow(mainWindow);
}

export function focusTradeWindow() {
  focusWindow(tradeWindow);
}
