import path from "node:path";
import { app, safeStorage } from "electron";
import Store from "electron-store";
import type {
  DesktopProtocolPayload,
  DesktopSettings,
  DesktopStorageHealth,
} from "../shared/ipc-types";

interface PersistedDesktopState {
  authVaultCiphertext?: string;
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
