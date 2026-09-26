import { NextResponse } from "next/server";
import {
  getPublicOriginFromRequest,
  secureTrackingRedirectUrl,
} from "./finalize-checkout-server";

import { codPlaceOrderRouteLogic } from "./payment-attempt-route-logic";

type RateLimitResult = { ok: true } | { ok: false; response: Response };

type PaymentAttemptRow = {
  cart_id: string;
  correlation_id: string;
  provider: string;
  status?: string;
  quote_fingerprint?: string | null;
  stale_reason?: string | null;
} | null;

type FinalizeResult =
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

export type CodPlaceOrderRouteDeps = {
  applyRateLimit: (_req: Request) => Promise<RateLimitResult>;
  readCartIdFromCookie: () => Promise<string | null>;
  getPaymentAttemptRow: (
    _correlationId: string,
    _requestedCartId?: string | null,
  ) => Promise<PaymentAttemptRow>;
  readCurrentQuoteFingerprint: (_cartId: string) => Promise<string | null>;
  incrementFinalizeAttempts: (_correlationId: string) => Promise<void>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  finalizeCheckout: (
    _cartId: string,
    _correlationId?: string,
  ) => Promise<FinalizeResult>;
  logEvent: (_payload: unknown) => void;
  nowIso: () => string;
};

export async function handleCodPlaceOrderRequest(
  req: Request,
  deps: CodPlaceOrderRouteDeps,
): Promise<Response> {
  const rl = await deps.applyRateLimit(req);
  if (!rl.ok) {
    return rl.response;
  }

  const cookieCartId = await deps.readCartIdFromCookie();

  let correlationId = "";
  try {
    const body = (await req.json()) as {
      correlationId?: string;
      cartId?: string;
    };
    if (typeof body.correlationId === "string" && body.correlationId.trim()) {
      correlationId = body.correlationId.trim();
    }
    if (!correlationId) {
      return NextResponse.json(
        { error: "correlationId is required" },
        { status: 400 },
      );
    }
    const requestedCartId =
      typeof body.cartId === "string" && body.cartId.trim()
        ? body.cartId.trim()
        : null;
    const cartId = cookieCartId ?? requestedCartId;

    const row = correlationId
      ? await deps.getPaymentAttemptRow(correlationId, cartId)
      : null;
    const currentQuoteFingerprint = cartId
      ? await deps.readCurrentQuoteFingerprint(cartId)
      : null;
    const result = await codPlaceOrderRouteLogic({
      correlationId,
      cartId,
      row,
      currentQuoteFingerprint,
      incrementFinalizeAttempts: deps.incrementFinalizeAttempts,
      claimFinalizeAttempt: deps.claimFinalizeAttempt,
      updatePaymentAttempt: deps.updatePaymentAttempt,
      finalizeCheckout: (activeCartId, correlationId) =>
        deps.finalizeCheckout(activeCartId, correlationId),
      logEvent: deps.logEvent,
      nowIso: deps.nowIso,
    });

    if (result.status === 200 && "redirectUrl" in result.body) {
      const redirectUrl = secureTrackingRedirectUrl(
        typeof result.body.redirectUrl === "string"
          ? result.body.redirectUrl
          : undefined,
        typeof result.body.orderId === "string" ? result.body.orderId : undefined,
        getPublicOriginFromRequest(req),
      );
      if (!redirectUrl) {
        return NextResponse.json(
          { error: "Tracking capability is not configured" },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { ...result.body, redirectUrl },
        { status: result.status },
      );
    }
    return NextResponse.json(result.body, { status: result.status });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
}
