import { contextBridge, ipcRenderer } from "electron";
import type {
  AuthProvider,
  DesktopBootstrapState,
  DesktopBridge,
  DesktopBridgeTradeRuntime,
  DesktopProtocolPayload,
  DesktopSettings,
  LobbyStateEvent,
  PendingTrade,
  SupabaseSession,
  TradeDetail,
  TransferCompleteEvent,
  TransferProgressEvent,
} from "../shared/ipc-types";

function subscribe<T>(channel: string, listener: (payload: T) => void) {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);

  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

const desktopBridge: DesktopBridge & DesktopBridgeTradeRuntime = {
  getBootstrapState: () =>
    ipcRenderer.invoke("desktop:get-bootstrap-state") as Promise<DesktopBootstrapState>,
  getSession: () => ipcRenderer.invoke("desktop:get-session") as Promise<SupabaseSession | null>,
  openOAuth: (provider: AuthProvider) => ipcRenderer.invoke("desktop:open-oauth", provider),
  sendMagicLink: (email: string) => ipcRenderer.invoke("desktop:send-magic-link", email),
  signOut: () => ipcRenderer.invoke("desktop:sign-out"),
  getPendingTrades: () =>
    ipcRenderer.invoke("desktop:get-pending-trades") as Promise<PendingTrade[]>,
  openTradeFromHandoff: (handoffToken: string) =>
    ipcRenderer.invoke("desktop:open-trade-from-handoff", handoffToken),
  getSettings: () => ipcRenderer.invoke("desktop:get-settings") as Promise<DesktopSettings>,
  setSettings: (settings: Partial<DesktopSettings>) =>
    ipcRenderer.invoke("desktop:set-settings", settings),
  selectDownloadPath: () => ipcRenderer.invoke("desktop:select-download-path"),
  getAppVersion: () => ipcRenderer.invoke("desktop:get-app-version"),
  onProtocolPayload: (listener: (payload: DesktopProtocolPayload) => void) =>
    subscribe("desktop:protocol-payload", listener),
  onSessionChanged: (listener: (session: SupabaseSession | null) => void) =>
    subscribe("desktop:session-changed", listener),
  getTradeDetail: (tradeId: string) =>
    ipcRenderer.invoke("desktop:get-trade-detail", tradeId) as Promise<TradeDetail>,
  startTransfer: (tradeId: string) => ipcRenderer.invoke("desktop:start-transfer", tradeId),
  cancelTransfer: (tradeId: string) => ipcRenderer.invoke("desktop:cancel-transfer", tradeId),
  confirmCompletion: (tradeId: string, rating: number) =>
    ipcRenderer.invoke("desktop:confirm-completion", tradeId, rating),
  openFileInExplorer: (filePath: string) =>
    ipcRenderer.invoke("desktop:open-file-in-explorer", filePath),
  onTransferProgress: (listener: (event: TransferProgressEvent) => void) =>
    subscribe("desktop:transfer-progress", listener),
  onTransferComplete: (listener: (event: TransferCompleteEvent) => void) =>
    subscribe("desktop:transfer-complete", listener),
  onLobbyStateChanged: (listener: (event: LobbyStateEvent) => void) =>
    subscribe("desktop:lobby-state-changed", listener),
};

contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);
