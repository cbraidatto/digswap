import fs from "node:fs";
import path from "node:path";

export interface DesktopSupabaseConfig {
  url: string;
  publishableKey: string;
  redirectTo: string;
  siteUrl: string;
  desktopVersionCode: number;
}

const ENV_KEY_ALIASES = {
  url: ["DESKTOP_SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  publishableKey: [
    "DESKTOP_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ],
  redirectTo: ["DESKTOP_SUPABASE_REDIRECT_URL", "VITE_SUPABASE_REDIRECT_URL"],
  siteUrl: ["DESKTOP_WEB_APP_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"],
  desktopVersionCode: ["DESKTOP_VERSION_CODE", "VITE_DESKTOP_VERSION_CODE"],
} as const;

function parseDotEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/u);
  const values: Record<string, string> = {};

  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/u);
    if (!match) {
      continue;
    }

    let value = match[2].trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[match[1]] = value;
  }

  return values;
}

function readWorkspaceFallbackEnv(): Record<string, string> {
  const candidates = [
    path.resolve(process.cwd(), "../web/.env.local"),
    path.resolve(process.cwd(), "../../apps/web/.env.local"),
    path.resolve(process.cwd(), "../../.env.local"),
  ];

  for (const candidate of candidates) {
    const values = parseDotEnvFile(candidate);
    if (Object.keys(values).length > 0) {
      return values;
    }
  }

  return {};
}

function readEnvValue(keys: readonly string[], fallbackEnv: Record<string, string>) {
  for (const key of keys) {
    const value = process.env[key] ?? fallbackEnv[key];
    if (value) {
      return value;
    }
  }

  return null;
}

function readIntegerEnvValue(keys: readonly string[], fallbackEnv: Record<string, string>, fallback: number) {
  const rawValue = readEnvValue(keys, fallbackEnv);
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function resolveDesktopSupabaseConfig(): {
  config: DesktopSupabaseConfig | null;
  error: string | null;
} {
  const fallbackEnv = readWorkspaceFallbackEnv();

  const url = readEnvValue(ENV_KEY_ALIASES.url, fallbackEnv);
  const publishableKey = readEnvValue(ENV_KEY_ALIASES.publishableKey, fallbackEnv);
  const redirectTo =
    readEnvValue(ENV_KEY_ALIASES.redirectTo, fallbackEnv) ?? "digswap://auth/callback";
  const siteUrl =
    readEnvValue(ENV_KEY_ALIASES.siteUrl, fallbackEnv) ?? "http://localhost:3000";
  const desktopVersionCode = readIntegerEnvValue(
    ENV_KEY_ALIASES.desktopVersionCode,
    fallbackEnv,
    1,
  );

  if (!url || !publishableKey) {
    return {
      config: null,
      error:
        "Desktop Supabase configuration is missing. Provide DESKTOP_SUPABASE_URL and DESKTOP_SUPABASE_PUBLISHABLE_KEY, or keep the web .env.local available for development.",
    };
  }

  return {
    config: {
      url,
      publishableKey,
      redirectTo,
      siteUrl,
      desktopVersionCode,
    },
    error: null,
  };
}
