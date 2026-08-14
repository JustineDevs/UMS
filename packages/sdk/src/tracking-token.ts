/**
 * HMAC-based tracking token for /track/[orderId] and /track?orderId=&t=
 * Spec: "Anonymous tracking SHALL use a scoped secret (e.g. HMAC of order id)
 * conveyed in the URL query string so that knowledge of the order UUID alone
 * is insufficient to read order or shipment data."
 *
 * Server-only: reads TRACKING_HMAC_SECRET from env.
 */
import { createHmac, timingSafeEqual } from "crypto";

const ALG = "sha256";

function getSecret(): string | undefined {
  return process.env.TRACKING_HMAC_SECRET?.trim() || undefined;
}

export function generateTrackingToken(id: string): string | null {
  const secret = getSecret();
  if (!secret) return null;
  const hmac = createHmac(ALG, secret);
  hmac.update(id);
  return hmac.digest("base64url");
}

export function verifyTrackingToken(id: string, token: string): boolean {
  const secret = getSecret();
  if (!secret) return false;
  const expected = generateTrackingToken(id);
  if (!expected) return false;
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(token, "utf8"),
      Buffer.from(expected, "utf8"),
    );
  } catch {
    return false;
  }
}

/**
 * Build tracking URL with signed token. Returns null if secret not configured
 * (caller should fall back to token-less for dev, or block in production).
 */
export function buildTrackingUrl(baseUrl: string, id: string): string | null {
  const token = generateTrackingToken(id);
  if (!token) return null;
  const cleanBase = baseUrl.replace(/\/$/, "");
  return `${cleanBase}/track/${encodeURIComponent(id)}?t=${encodeURIComponent(token)}`;
}
