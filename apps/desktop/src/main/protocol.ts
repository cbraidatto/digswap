import path from "node:path";
import { app } from "electron";
import type {
  AuthCallbackPayload,
  DesktopProtocolPayload,
  TradeHandoffPayload,
} from "../shared/ipc-types";

const DIGSWAP_PROTOCOL = "digswap";

function createPayloadBase(rawUrl: string) {
  return {
    rawUrl,
    receivedAt: new Date().toISOString(),
  };
}

export function registerProtocolClient() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(
      DIGSWAP_PROTOCOL,
      process.execPath,
      [path.resolve(process.argv[1])],
    );
    return;
  }

  app.setAsDefaultProtocolClient(DIGSWAP_PROTOCOL);
}

export function extractProtocolUrlFromArgv(argv: string[]) {
  return argv.find((value) => value.startsWith(`${DIGSWAP_PROTOCOL}://`)) ?? null;
}

export function parseProtocolUrl(rawUrl: string): DesktopProtocolPayload | null {
  try {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== `${DIGSWAP_PROTOCOL}:`) {
      return null;
    }

    if (parsed.hostname === "trade") {
      const tradeId = parsed.pathname.replace(/^\/+/u, "");
      const token = parsed.searchParams.get("handoff");

      if (!tradeId || !token) {
        return null;
      }

      const payload: TradeHandoffPayload = {
        kind: "trade-handoff",
        tradeId,
        token,
        handoffToken: token,
        ...createPayloadBase(rawUrl),
      };

      return payload;
    }

    if (parsed.hostname === "auth" && parsed.pathname === "/callback") {
      const payload: AuthCallbackPayload = {
        kind: "auth-callback",
        code: parsed.searchParams.get("code"),
        errorCode: parsed.searchParams.get("error") ?? parsed.searchParams.get("error_code"),
        errorDescription: parsed.searchParams.get("error_description"),
        ...createPayloadBase(rawUrl),
      };

      return payload;
    }

    return null;
  } catch {
    return null;
  }
}
