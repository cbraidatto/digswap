import { createClient, type Session } from "@supabase/supabase-js";
import { shell } from "electron";
import type {
  AuthCallbackPayload,
  AuthProvider,
  DesktopShellSessionPayload,
  SupabaseSession,
} from "../shared/ipc-types";
import type { DesktopSupabaseConfig } from "./config";
import type { DesktopSessionStore } from "./session-store";

interface PendingOAuthRequest {
  reject: (error: Error) => void;
  resolve: () => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

function mapSession(session: Session | null): SupabaseSession | null {
  if (!session) {
    return null;
  }

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token ?? "",
    expiresAt: session.expires_at ?? 0,
    user: {
      id: session.user.id,
      email: session.user.email ?? null,
      userMetadata: {
        full_name: session.user.user_metadata.full_name,
        avatar_url: session.user.user_metadata.avatar_url,
        name: session.user.user_metadata.name,
      },
    },
  };
}

export class DesktopSupabaseAuth {
  private readonly client;
  private pendingOAuth: PendingOAuthRequest | null = null;
  private readonly sessionListeners = new Set<(session: SupabaseSession | null) => void>();

  constructor(
    private readonly config: DesktopSupabaseConfig | null,
    private readonly configError: string | null,
    private readonly sessionStore: DesktopSessionStore,
  ) {
    if (!config) {
      this.client = null;
      return;
    }

    this.client = createClient(config.url, config.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage: {
          getItem: (key) => this.sessionStore.getVaultItem(key),
          removeItem: (key) => this.sessionStore.removeVaultItem(key),
          setItem: (key, value) => this.sessionStore.setVaultItem(key, value),
        },
      },
    });

    this.client.auth.onAuthStateChange((_event, session) => {
      this.emitSession(mapSession(session));
    });
  }

  getConfigError() {
    return this.configError;
  }

  onSessionChanged(listener: (session: SupabaseSession | null) => void) {
    this.sessionListeners.add(listener);

    return () => {
      this.sessionListeners.delete(listener);
    };
  }

  getClientOrThrow() {
    if (!this.client) {
      throw new Error(this.configError ?? "Desktop auth is not configured.");
    }

    return this.client;
  }

  async getSession() {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw error;
    }

    return mapSession(data.session);
  }

  async getAccessToken() {
    if (!this.client) {
      return null;
    }

    const { data, error } = await this.client.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session?.access_token ?? null;
  }

  async importSession(tokens: DesktopShellSessionPayload) {
    const client = this.getClientOrThrow();

    if (!tokens.accessToken || !tokens.refreshToken) {
      throw new Error("Desktop session sync requires both access and refresh tokens.");
    }

    const currentSession = await this.getSession();
    if (
      currentSession?.accessToken === tokens.accessToken &&
      currentSession.refreshToken === tokens.refreshToken
    ) {
      return;
    }

    const { data, error } = await client.auth.setSession({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    if (error) {
      throw error;
    }

    this.emitSession(mapSession(data.session));
  }

  async clearImportedSession() {
    if (!this.client) {
      await this.sessionStore.clearVault();
      this.emitSession(null);
      return;
    }

    const currentSession = await this.getSession();
    if (!currentSession) {
      await this.sessionStore.clearVault();
      this.emitSession(null);
      return;
    }

    const { error } = await this.client.auth.signOut();
    if (error) {
      throw error;
    }

    await this.sessionStore.clearVault();
    this.emitSession(null);
  }

  async startOAuthSignIn(provider: AuthProvider) {
    if (!this.client || !this.config) {
      throw new Error(this.configError ?? "Desktop auth is not configured.");
    }

    if (provider !== "google") {
      throw new Error("Email sign-in is not implemented in the desktop shell yet.");
    }

    if (this.pendingOAuth) {
      throw new Error("An OAuth flow is already in progress.");
    }

    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: this.config.redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    if (!data.url) {
      throw new Error("Supabase did not return an OAuth URL for desktop sign-in.");
    }

    await shell.openExternal(data.url);

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingOAuth = null;
        reject(new Error("Timed out waiting for the DigSwap auth callback."));
      }, 5 * 60 * 1000);

      this.pendingOAuth = {
        reject,
        resolve,
        timeoutId,
      };
    });
  }

  async startMagicLinkSignIn(email: string) {
    if (!this.client || !this.config) {
      throw new Error(this.configError ?? "Desktop auth is not configured.");
    }

    if (this.pendingOAuth) {
      throw new Error("An auth flow is already in progress.");
    }

    const { error } = await this.client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: this.config.redirectTo },
    });

    if (error) {
      throw error;
    }

    return new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pendingOAuth = null;
        reject(new Error("Timed out waiting for the magic link callback."));
      }, 10 * 60 * 1000);

      this.pendingOAuth = { reject, resolve, timeoutId };
    });
  }

  async handleAuthCallback(payload: AuthCallbackPayload) {
    if (!this.client) {
      return;
    }

    if (payload.errorCode || payload.errorDescription) {
      this.rejectPendingOAuth(
        new Error(payload.errorDescription ?? payload.errorCode ?? "Desktop auth failed."),
      );
      return;
    }

    if (!payload.code) {
      this.rejectPendingOAuth(new Error("Desktop auth callback arrived without an OAuth code."));
      return;
    }

    const { error } = await this.client.auth.exchangeCodeForSession(payload.code);
    if (error) {
      this.rejectPendingOAuth(new Error(error.message));
      return;
    }

    this.resolvePendingOAuth();
  }

  async signOut() {
    await this.clearImportedSession();
  }

  /** Broadcasts the current in-memory session to all registered listeners. */
  notifySessionListeners() {
    void this.getSession().then((session) => this.emitSession(session));
  }

  private rejectPendingOAuth(error: Error) {
    if (!this.pendingOAuth) {
      return;
    }

    clearTimeout(this.pendingOAuth.timeoutId);
    this.pendingOAuth.reject(error);
    this.pendingOAuth = null;
  }

  private resolvePendingOAuth() {
    if (!this.pendingOAuth) {
      return;
    }

    clearTimeout(this.pendingOAuth.timeoutId);
    this.pendingOAuth.resolve();
    this.pendingOAuth = null;
  }

  private emitSession(session: SupabaseSession | null) {
    for (const listener of this.sessionListeners) {
      listener(session);
    }
  }
}
