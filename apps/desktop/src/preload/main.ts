import { contextBridge, ipcRenderer } from "electron";
import type { DesktopMainShellBridge } from "../shared/ipc-types";

const desktopShell: DesktopMainShellBridge = {
  isDesktop: () => true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  // SECURITY: syncSession removed — was a session fixation vector (raw tokens from renderer).
  // The handler in main/ipc.ts is disabled and throws; removing from preload prevents
  // any renderer code from even attempting to call it.
  syncHandoffCode: (code: string | null) =>
    ipcRenderer.invoke("desktop-shell:sync-handoff-code", code),
  setAutoStart: (enabled: boolean) =>
    ipcRenderer.invoke("desktop:set-auto-start", enabled) as Promise<void>,
  getAutoStart: () =>
    ipcRenderer.invoke("desktop:get-auto-start") as Promise<boolean>,
};

contextBridge.exposeInMainWorld("desktopShell", desktopShell);
