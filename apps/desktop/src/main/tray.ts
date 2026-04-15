import path from "node:path";
import { Tray, Menu, nativeImage, app, type NativeImage } from "electron";
import { focusMainWindow } from "./window";

let tray: Tray | null = null;

// Minimal 16x16 white circle on transparent background (PNG base64).
// Used as fallback when the file-based icon cannot be loaded.
const FALLBACK_ICON_BASE64 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAA" +
  "AQCAYAAAAf8/9hAAAAdklEQVQ4T2NkoBAwUqifYdQABmoHg" +
  "f+/f/9nYGBgZGBkZGT4//8/AwMDA8P/f/8ZGP7/Z2BgZGRg" +
  "ZPj/H6QAJM7AwMDIwMjACNLMwMDAyMjI8P///38MjAz/GRgY" +
  "GBkZGRn+//vHwMjAyMDIwMjw/z9YnIGBkQEAseAfEVSWoG4A" +
  "AAAASUVORK5CYII=";

function loadTrayIcon(): NativeImage {
  const iconPath = path.join(__dirname, "../../resources/tray-icon.png");
  try {
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      throw new Error("Tray icon is empty");
    }
    return icon.resize({ width: 16, height: 16 });
  } catch {
    return nativeImage.createFromDataURL(FALLBACK_ICON_BASE64);
  }
}

export function createTray(): void {
  if (tray && !tray.isDestroyed()) {
    return;
  }

  const icon = loadTrayIcon();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open", click: () => focusMainWindow() },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ]);

  tray.setToolTip("DigSwap Desktop");
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => focusMainWindow());
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
}
