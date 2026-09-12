import { buildTrackingUrl, DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

export type MedusaCartCompleteResult =
  | {
      ok: true;
      orderId: string;
      redirectUrl: string;
      attempts: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      attempts: number;
    };

export type FinalizeMedusaCartOptions = {
  /**
   * Total `cart.complete()` calls (including the first). Interactive API routes use a low value;
   * cron/workers pass a higher value. Capped at 20.
   */
  maxCompleteAttempts?: number;
  publicOrigin?: string;
  correlationId?: string;
};

export function getPublicOriginFromRequest(req: Request): string {
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const internal = new URL(req.url);
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : internal.protocol.replace(":", "");
  const host = forwardedHost || req.headers.get("host") || internal.host;
  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch {
    return internal.origin;
  }
}

export function secureTrackingRedirectUrl(
  redirectUrl: string | undefined,
  orderId: string | undefined,
  baseUrl: string,
): string | null {
  if (typeof redirectUrl === "string") {
    try {
      const parsed = new URL(redirectUrl, baseUrl);
      const origin = new URL(baseUrl).origin;
      if (
        parsed.origin === origin &&
        parsed.pathname.startsWith("/track/") &&
        parsed.pathname.split("/").at(-1)?.startsWith("cap_") &&
        !parsed.search &&
        !parsed.hash
      ) {
        return parsed.toString();
      }
    } catch {
      return null;
    }
  }
  if (!orderId) return null;
  return buildTrackingUrl(baseUrl, orderId, {
    storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
  });
}

/**
 * Server-only compatibility wrapper around Worker-native order finalization.
 * The legacy cart-complete SDK path is intentionally removed: finalization must
 * be authorized by the APP payment-attempt correlation and committed by the Worker.
 */
export async function finalizeMedusaCartFromServer(
  cartId: string,
  options?: FinalizeMedusaCartOptions,
): Promise<MedusaCartCompleteResult> {
  const maxAttempts = Math.max(
    1,
    Math.min(20, options?.maxCompleteAttempts ?? 3),
  );

  const correlationId = options?.correlationId?.trim();
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!correlationId || !workerBaseUrl) {
    return {
      ok: false,
      status: 503,
      error: workerBaseUrl
        ? "Payment finalization correlation is required"
        : "Worker API is not configured",
      attempts: 0,
    };
  }

  let orderId: string | undefined;
  let errorMessage = "Order not ready";
  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts += 1;
    const response = await fetch(
      `${workerBaseUrl}/store/checkout-intents/${encodeURIComponent(correlationId)}/finalize`,
      { method: "POST", cache: "no-store" },
    );
    const payload = (await response.json().catch(() => ({}))) as {
      orderId?: unknown;
      error?: unknown;
    };
    orderId = typeof payload.orderId === "string" ? payload.orderId : undefined;
    errorMessage = typeof payload.error === "string" ? payload.error : errorMessage;
    if (response.ok && orderId) break;
    if (response.status === 409 || response.status === 422) break;
    if (attempts < maxAttempts) await new Promise((r) => setTimeout(r, 280 + attempts * 120));
  }

  if (!orderId) {
    return { ok: false, status: 409, error: errorMessage, attempts };
  }

  const base =
    options?.publicOrigin?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    DEFAULT_PUBLIC_SITE_ORIGIN;
  const redirectUrl = buildTrackingUrl(base, orderId, {
    storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim(),
  });
  if (!redirectUrl) {
    return {
      ok: false,
      status: 503,
      error: "Secure order tracking is temporarily unavailable",
      attempts,
    };
  }
  return {
    ok: true,
    orderId,
    redirectUrl,
    attempts,
  };
}
