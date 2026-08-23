import { buildTrackingUrl, DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

import { createStorefrontMedusaSdk } from "@/lib/medusa-sdk";

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
        !parsed.searchParams.has("t")
      ) {
        return redirectUrl;
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

type CompleteResponse = {
  type?: string;
  order?: { id?: string };
  error?: { message?: string } | string;
};

/**
 * Server-only: completes the Medusa cart and builds tracking URL. Used by API routes and cron recovery.
 * Retries belong here only for transient Medusa lag; heavy recovery is cron/worker-driven.
 */
export async function finalizeMedusaCartFromServer(
  cartId: string,
  options?: FinalizeMedusaCartOptions,
): Promise<MedusaCartCompleteResult> {
  const maxAttempts = Math.max(
    1,
    Math.min(20, options?.maxCompleteAttempts ?? 3),
  );

  const sdk = createStorefrontMedusaSdk();
  const storeCart = sdk.store.cart as unknown as {
    complete?: (_id: string, _body?: unknown) => Promise<CompleteResponse>;
  };
  if (typeof storeCart.complete !== "function") {
    return {
      ok: false,
      status: 501,
      error: "Cart completion is not available",
      attempts: 0,
    };
  }

  let completed = await storeCart.complete(cartId, {});
  let attempts = 1;
  while (
    attempts < maxAttempts &&
    (completed?.type !== "order" || !completed.order?.id)
  ) {
    await new Promise((r) => setTimeout(r, 280 + attempts * 120));
    completed = await storeCart.complete(cartId, {});
    attempts += 1;
  }

  if (completed?.type !== "order" || !completed.order?.id) {
    const errMsg =
      typeof completed?.error === "string"
        ? completed.error
        : completed?.error &&
            typeof completed.error === "object" &&
            "message" in completed.error
          ? String((completed.error as { message?: string }).message)
          : "Order not ready";
    return { ok: false, status: 409, error: errMsg, attempts };
  }

  const orderId = completed.order.id;
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
