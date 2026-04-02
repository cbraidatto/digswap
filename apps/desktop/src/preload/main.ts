import { contextBridge, ipcRenderer } from "electron";
import type { DesktopMainShellBridge, DesktopShellSessionPayload } from "../shared/ipc-types";

const desktopShell: DesktopMainShellBridge = {
  isDesktop: () => true,
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version") as Promise<string>,
  syncSession: (session: DesktopShellSessionPayload | null) =>
    ipcRenderer.invoke("desktop-shell:sync-session", session),
};

contextBridge.exposeInMainWorld("desktopShell", desktopShell);
