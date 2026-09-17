import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * HMAC-SHA256 hex digest of the raw body, compared in constant time to the header value.
 */
export function verifyChannelWebhookSignature(
  rawBody: string,
  secret: string,
  headerSig: string,
): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(headerSig.trim(), "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
