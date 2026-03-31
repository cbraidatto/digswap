import fs from "node:fs";
import path from "node:path";

export interface DesktopSupabaseConfig {
  url: string;
  publishableKey: string;
  redirectTo: string;
}

const ENV_KEY_ALIASES = {
  url: ["DESKTOP_SUPABASE_URL", "VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"],
  publishableKey: [
    "DESKTOP_SUPABASE_PUBLISHABLE_KEY",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ],
  redirectTo: ["DESKTOP_SUPABASE_REDIRECT_URL", "VITE_SUPABASE_REDIRECT_URL"],
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

export function resolveDesktopSupabaseConfig(): {
  config: DesktopSupabaseConfig | null;
  error: string | null;
} {
  const fallbackEnv = readWorkspaceFallbackEnv();

  const url = readEnvValue(ENV_KEY_ALIASES.url, fallbackEnv);
  const publishableKey = readEnvValue(ENV_KEY_ALIASES.publishableKey, fallbackEnv);
  const redirectTo =
    readEnvValue(ENV_KEY_ALIASES.redirectTo, fallbackEnv) ?? "digswap://auth/callback";

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
    },
    error: null,
  };
}
