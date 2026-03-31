import { randomUUID } from "node:crypto";
import path from "node:path";
import { app, safeStorage } from "electron";
import Store from "electron-store";
import type { TradeTransferReceipt } from "@digswap/trade-domain";
import type {
  DesktopProtocolPayload,
  DesktopSettings,
  DesktopStorageHealth,
} from "../shared/ipc-types";

export interface PendingTransferReceiptRecord extends TradeTransferReceipt {
  lastAttemptAt: string | null;
  lastError: string | null;
  queuedAt: string;
}

interface PersistedDesktopState {
  authVaultCiphertext?: string;
  deviceId?: string;
  lastSourceDirectory?: string;
  pendingTransferReceipts: PendingTransferReceiptRecord[];
  settings: DesktopSettings;
  lastProtocolPayload: DesktopProtocolPayload | null;
}

const STORE_NAME = "desktop-state";

function getStorageBackendName() {
  if (typeof safeStorage.getSelectedStorageBackend === "function") {
    return safeStorage.getSelectedStorageBackend();
  }

  return null;
}

function getDefaultDownloadPath() {
  return path.join(app.getPath("music"), "DigSwap", "Incoming");
}

export class DesktopSessionStore {
  private readonly store = new Store<PersistedDesktopState>({
    name: STORE_NAME,
    defaults: {
      settings: {
        downloadPath: getDefaultDownloadPath(),
        updateChannel: "stable",
      },
      lastProtocolPayload: null,
      pendingTransferReceipts: [],
    },
  });

  getStorageHealth(): DesktopStorageHealth {
    const encryptionAvailable = safeStorage.isEncryptionAvailable();
    const backend = getStorageBackendName();

    return {
      encryptionAvailable,
      backend,
      secure: encryptionAvailable && backend !== "basic_text",
    };
  }

  getSettings() {
    return this.store.get("settings");
  }

  setSettings(settings: Partial<DesktopSettings>) {
    this.store.set("settings", {
      ...this.getSettings(),
      ...settings,
    });
  }

  getLastProtocolPayload() {
    return this.store.get("lastProtocolPayload");
  }

  setLastProtocolPayload(payload: DesktopProtocolPayload | null) {
    this.store.set("lastProtocolPayload", payload);
  }

  getLastSourceDirectory() {
    return this.store.get("lastSourceDirectory") ?? null;
  }

  setLastSourceDirectory(directoryPath: string) {
    this.store.set("lastSourceDirectory", directoryPath);
  }

  getOrCreateDeviceId() {
    const existingDeviceId = this.store.get("deviceId");
    if (existingDeviceId) {
      return existingDeviceId;
    }

    const deviceId = randomUUID();
    this.store.set("deviceId", deviceId);
    return deviceId;
  }

  getPendingTransferReceipts() {
    return this.store.get("pendingTransferReceipts");
  }

  upsertPendingTransferReceipt(receipt: PendingTransferReceiptRecord) {
    const receipts = this.getPendingTransferReceipts();
    const nextReceipts = receipts.filter(
      (currentReceipt) =>
        !(
          currentReceipt.tradeId === receipt.tradeId &&
          currentReceipt.deviceId === receipt.deviceId &&
          currentReceipt.fileHashSha256 === receipt.fileHashSha256
        ),
    );

    nextReceipts.push(receipt);
    this.store.set("pendingTransferReceipts", nextReceipts);
  }

  removePendingTransferReceipt(tradeId: string, deviceId: string, fileHashSha256: string) {
    const nextReceipts = this.getPendingTransferReceipts().filter(
      (receipt) =>
        !(
          receipt.tradeId === tradeId &&
          receipt.deviceId === deviceId &&
          receipt.fileHashSha256 === fileHashSha256
        ),
    );

    this.store.set("pendingTransferReceipts", nextReceipts);
  }

  async getVaultItem(key: string) {
    const vault = this.readVault();
    return vault[key] ?? null;
  }

  async setVaultItem(key: string, value: string) {
    const vault = this.readVault();
    vault[key] = value;
    this.writeVault(vault);
  }

  async removeVaultItem(key: string) {
    const vault = this.readVault();
    delete vault[key];
    this.writeVault(vault);
  }

  async clearVault() {
    this.store.delete("authVaultCiphertext");
  }

  private readVault() {
    const ciphertext = this.store.get("authVaultCiphertext");

    if (!ciphertext) {
      return {} as Record<string, string>;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage is unavailable, so the desktop auth vault cannot be decrypted.");
    }

    const plaintext = safeStorage.decryptString(Buffer.from(ciphertext, "base64"));
    return JSON.parse(plaintext) as Record<string, string>;
  }

  private writeVault(vault: Record<string, string>) {
    if (Object.keys(vault).length === 0) {
      this.store.delete("authVaultCiphertext");
      return;
    }

    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("safeStorage is unavailable, so the desktop auth vault cannot be encrypted.");
    }

    const ciphertext = safeStorage.encryptString(JSON.stringify(vault));
    this.store.set("authVaultCiphertext", ciphertext.toString("base64"));
  }
}
