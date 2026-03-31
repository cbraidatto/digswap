import type { SupabaseClient } from "@supabase/supabase-js";

const GOOGLE_STUN_SERVER: RTCIceServer = {
  urls: "stun:stun.l.google.com:19302",
};

function normalizeIceServers(payload: unknown): RTCIceServer[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !("urls" in entry)) {
      return [];
    }

    const urls = (entry as { urls?: unknown }).urls;
    if (typeof urls !== "string" && !Array.isArray(urls)) {
      return [];
    }

    return [
      {
        urls,
        username:
          typeof (entry as { username?: unknown }).username === "string"
            ? (entry as { username: string }).username
            : undefined,
        credential:
          typeof (entry as { credential?: unknown }).credential === "string"
            ? (entry as { credential: string }).credential
            : undefined,
      } satisfies RTCIceServer,
    ];
  });
}

export async function fetchTurnCredentials(supabase: SupabaseClient): Promise<RTCIceServer[]> {
  const iceServers: RTCIceServer[] = [GOOGLE_STUN_SERVER];

  try {
    const functionResult = await supabase.functions.invoke("get-turn-credentials");
    if (!functionResult.error) {
      const extraServers = normalizeIceServers(functionResult.data);
      if (extraServers.length > 0) {
        return dedupeIceServers([...iceServers, ...extraServers]);
      }
    }
  } catch (error) {
    console.warn("[webrtc] get-turn-credentials function unavailable, falling back to STUN", error);
  }

  try {
    const rpcResult = await supabase.rpc("get_turn_credentials");
    if (!rpcResult.error) {
      const extraServers = normalizeIceServers(rpcResult.data);
      if (extraServers.length > 0) {
        return dedupeIceServers([...iceServers, ...extraServers]);
      }
    }
  } catch (error) {
    console.warn("[webrtc] get_turn_credentials RPC unavailable, falling back to STUN", error);
  }

  return iceServers;
}

function dedupeIceServers(servers: RTCIceServer[]) {
  const seen = new Set<string>();

  return servers.filter((server) => {
    const key = JSON.stringify({
      urls: server.urls,
      username: server.username ?? null,
      credential: server.credential ?? null,
    });

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
