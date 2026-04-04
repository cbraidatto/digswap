import { createHmac } from "node:crypto";

/**
 * Generate an HMAC signature for OG image query params.
 * Prevents forged rarity cards — only server-side code can sign.
 * sig = HMAC-SHA256(username:total:ultra:avg, secret).slice(0, 16)
 */
export function signOgParams(
  username: string,
  total: string | number,
  ultra: string | number,
  avg: string | number,
): string {
  const secret = process.env.HANDOFF_HMAC_SECRET ?? "dev-hmac-secret-not-for-production";
  const data = `${username}:${total}:${ultra}:${avg}`;
  return createHmac("sha256", secret).update(data).digest("hex").slice(0, 16);
}
