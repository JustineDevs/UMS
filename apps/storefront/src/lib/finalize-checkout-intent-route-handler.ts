import { NextResponse } from "next/server";
import {
  getPublicOriginFromRequest,
  secureTrackingRedirectUrl,
} from "./finalize-medusa-cart-server";

import { finalizeCheckoutIntentRouteLogic } from "./payment-attempt-route-logic";

type RateLimitResult =
  | { ok: true }
  | { ok: false; response: Response };

type PaymentAttemptRow = {
  cart_id: string;
  correlation_id: string;
  provider: string;
  provider_session_id?: string | null;
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

export type FinalizeCheckoutIntentRouteDeps = {
  applyRateLimit: (_req: Request) => Promise<RateLimitResult>;
  readCartIdFromCookie: () => Promise<string | null>;
  getPaymentAttemptRow: (_correlationId: string) => Promise<PaymentAttemptRow>;
  readCurrentQuoteFingerprint: (_cartId: string) => Promise<string | null>;
  incrementFinalizeAttempts: (_correlationId: string) => Promise<void>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  verifyProviderPayment?: (_row: PaymentAttemptRow, _cartId: string) => Promise<boolean>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  finalizeMedusaCart: (_cartId: string, _publicOrigin?: string) => Promise<FinalizeResult>;
  logEvent: (_payload: unknown) => void;
  nowIso: () => string;
};

export async function handleFinalizeCheckoutIntentRequest(
  req: Request,
  correlationId: string,
  deps: FinalizeCheckoutIntentRouteDeps,
): Promise<Response> {
  const rl = await deps.applyRateLimit(req);
  if (!rl.ok) {
    return rl.response;
  }

  const cartId = await deps.readCartIdFromCookie();
  const row = correlationId.trim()
    ? await deps.getPaymentAttemptRow(correlationId.trim())
    : null;
  const currentQuoteFingerprint = cartId
    ? await deps.readCurrentQuoteFingerprint(cartId)
    : null;

  const result = await finalizeCheckoutIntentRouteLogic({
    correlationId,
    cartId,
    row,
    currentQuoteFingerprint,
    incrementFinalizeAttempts: deps.incrementFinalizeAttempts,
    claimFinalizeAttempt: deps.claimFinalizeAttempt,
    verifyProviderPayment:
      row && cartId && deps.verifyProviderPayment
        ? () => deps.verifyProviderPayment!(row, cartId)
        : undefined,
    updatePaymentAttempt: deps.updatePaymentAttempt,
    finalizeMedusaCart: (activeCartId) =>
      deps.finalizeMedusaCart(activeCartId, getPublicOriginFromRequest(req)),
    logEvent: deps.logEvent,
    nowIso: deps.nowIso,
  });

  if (result.status === 200 && "redirectUrl" in result.body) {
    const redirectUrl = secureTrackingRedirectUrl(
      typeof result.body.redirectUrl === "string" ? result.body.redirectUrl : undefined,
      typeof result.body.orderId === "string" ? result.body.orderId : undefined,
      getPublicOriginFromRequest(req),
    );
    if (!redirectUrl) {
      return NextResponse.json(
        { error: "Tracking capability is not configured" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ...result.body, redirectUrl }, { status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
