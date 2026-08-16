import { NextResponse } from "next/server";
import { getPublicOriginFromRequest } from "./finalize-medusa-cart-server";

import { codPlaceOrderRouteLogic } from "./payment-attempt-route-logic";

type RateLimitResult =
  | { ok: true }
  | { ok: false; response: Response };

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
  getPaymentAttemptRow: (_correlationId: string) => Promise<PaymentAttemptRow>;
  readCurrentQuoteFingerprint: (_cartId: string) => Promise<string | null>;
  incrementFinalizeAttempts: (_correlationId: string) => Promise<void>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  finalizeMedusaCart: (_cartId: string, _publicOrigin?: string) => Promise<FinalizeResult>;
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

  const cartId = await deps.readCartIdFromCookie();

  let correlationId = "";
  try {
    const body = (await req.json()) as { correlationId?: string };
    if (typeof body.correlationId === "string" && body.correlationId.trim()) {
      correlationId = body.correlationId.trim();
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = correlationId
    ? await deps.getPaymentAttemptRow(correlationId)
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
    finalizeMedusaCart: (activeCartId) =>
      deps.finalizeMedusaCart(activeCartId, getPublicOriginFromRequest(req)),
    logEvent: deps.logEvent,
    nowIso: deps.nowIso,
  });

  return NextResponse.json(result.body, { status: result.status });
}
