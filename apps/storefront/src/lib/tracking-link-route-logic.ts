export type TrackingLinkRouteResult = {
  status: number;
  body: Record<string, unknown>;
};

type TrackingLinkRouteInput = {
  cartId: string;
  ownedCartId: string | null;
  rateLimited: boolean;
  retryAfterSec?: number;
  buildTrackingUrl: (_cartId: string) => string | null;
};

export function trackingLinkRouteLogic(
  input: TrackingLinkRouteInput,
): TrackingLinkRouteResult {
  if (input.rateLimited) {
    return {
      status: 429,
      body: {
        error: "Too many requests",
        retryAfter: input.retryAfterSec ?? 1,
      },
    };
  }

  const cartId = input.cartId.trim();
  if (!cartId || !cartId.startsWith("cart_")) {
    return {
      status: 400,
      body: { error: "cartId required" },
    };
  }
  if (cartId !== input.ownedCartId) {
    return { status: 403, body: { error: "Cart ownership could not be verified" } };
  }

  const url = input.buildTrackingUrl(cartId);
  if (!url) {
    return {
      status: 503,
      body: { error: "Tracking links require TRACKING_HMAC_SECRET (not configured)" },
    };
  }

  return {
    status: 200,
    body: { trackingPageUrl: url },
  };
}
