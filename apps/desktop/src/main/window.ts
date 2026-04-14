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

function resolvePreloadPath(name: "main" | "trade") {
  return path.join(__dirname, `../preload/${name}.js`);
}

function resolveLocalRendererFilePath() {
  return path.join(__dirname, "../renderer/index.html");
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

export async function createMainWindow(config: MainWindowConfig) {
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

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(config.siteUrl);

  return mainWindow;
}


export function getMainWindow() {
  return mainWindow;
}

export function focusMainWindow() {
  focusWindow(mainWindow);
}
