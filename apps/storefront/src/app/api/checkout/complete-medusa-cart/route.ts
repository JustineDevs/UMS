import { NextResponse } from "next/server";
import {
  getPaymentAttemptByCorrelationId,
  updatePaymentAttemptByCorrelationId,
} from "@universal-music-store/platform-data";

import { applyRateLimit, readCartIdFromCookie } from "@/lib/cart-api-helpers";
import { logCheckoutCompletionEvent } from "@/lib/checkout-telemetry";
import {
  finalizeMedusaCartFromServer,
  getPublicOriginFromRequest,
} from "@/lib/finalize-medusa-cart-server";
import { createStorefrontServiceSupabase } from "@/lib/storefront-supabase";
import { withBotIdProtection } from "@/lib/botid-protection";
import { capturePostHogEvent } from "@universal-music-store/sdk";

function jsonNoStore(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
): NextResponse<unknown> {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * @deprecated Legacy cart completion (cookie-bound). Primary path: POST
 * `/api/payments/checkout-intents/:correlationId/finalize` (or COD `/api/checkout/cod-place-order`).
 * This legacy path is permanently disabled. Checkout completion must carry a
 * verified payment-attempt correlation id so the cart cannot be completed by
 * cookie possession alone.
 */
async function handlePOST(req: Request) {
  const rl = await applyRateLimit(req, "complete-medusa-cart", 40, 60_000);
  if (!rl.ok) {
    return rl.response;
  }

  if (process.env.STOREFRONT_LEGACY_CART_COMPLETION_ALLOW !== "true") {
    return jsonNoStore(
      {
        error:
          "Legacy cart completion is disabled. Use POST /api/payments/checkout-intents/:correlationId/finalize.",
        code: "LEGACY_ROUTE_DISABLED",
      },
      { status: 410 },
    );
  }

  const cartId = await readCartIdFromCookie();
  if (!cartId) {
    logCheckoutCompletionEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 400,
      errorCode: "no_cart",
      message: "No active cart",
    });
    return NextResponse.json(
      { error: "No active cart", code: "NO_CART" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const cartSuffix = cartId.length > 8 ? cartId.slice(-8) : cartId;

  let correlationId: string | undefined;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      correlationId?: string;
    };
    if (typeof body.correlationId === "string" && body.correlationId.trim()) {
      correlationId = body.correlationId.trim();
    }
  } catch {
    correlationId = undefined;
  }

  const sb = createStorefrontServiceSupabase();

  try {
    const result = await finalizeMedusaCartFromServer(cartId, {
      maxCompleteAttempts: 6,
      publicOrigin: getPublicOriginFromRequest(req),
    });

    if (!result.ok) {
      logCheckoutCompletionEvent({
        stage: "complete_medusa_cart",
        outcome: "failure",
        httpStatus: result.status,
        cartIdSuffix: cartSuffix,
        attempts: result.attempts,
        errorCode:
          result.status === 409 ? "order_not_ready" : "complete_failed",
        message: result.error.slice(0, 500),
      });
      if (sb && correlationId) {
        const row = await getPaymentAttemptByCorrelationId(sb, correlationId);
        if (row && row.cart_id === cartId) {
          await updatePaymentAttemptByCorrelationId(sb, correlationId, {
            status: "paid_awaiting_order",
            checkout_state: "awaiting_completion",
            last_error: result.error.slice(0, 2000),
          }).catch(() => {});
        }
      }
      void capturePostHogEvent({
        event: "checkout_completion_failed",
        distinctId: correlationId ?? cartSuffix,
        properties: {
          stage: "complete_medusa_cart",
          httpStatus: result.status,
          attempts: result.attempts,
          errorCode: result.status === 409 ? "order_not_ready" : "complete_failed",
          message: result.error.slice(0, 500),
        },
      });
      return jsonNoStore(
        { error: result.error, code: "COMPLETE_CART_FAILED" },
        { status: result.status },
      );
    }

    if (sb && correlationId) {
      const row = await getPaymentAttemptByCorrelationId(sb, correlationId);
      if (row && row.cart_id === cartId) {
        await updatePaymentAttemptByCorrelationId(sb, correlationId, {
          status: "completed",
          checkout_state: "completed",
          medusa_order_id: result.orderId,
          order_id: result.orderId,
          last_error: null,
          finalized_at: new Date().toISOString(),
        }).catch(() => {});
      }
    }

    logCheckoutCompletionEvent({
      stage: "complete_medusa_cart",
      outcome: "success",
      httpStatus: 200,
      cartIdSuffix: cartSuffix,
      orderId: result.orderId,
      attempts: result.attempts,
    });
    void capturePostHogEvent({
      event: "checkout_completion_succeeded",
      distinctId: correlationId ?? cartSuffix,
      properties: {
        stage: "complete_medusa_cart",
        httpStatus: 200,
        orderId: result.orderId,
        attempts: result.attempts,
      },
    });

    return jsonNoStore({
      ok: true,
      orderId: result.orderId,
      redirectUrl: result.redirectUrl,
      code: "OK",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Complete failed";
    logCheckoutCompletionEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 503,
      cartIdSuffix: cartSuffix,
      errorCode: "exception",
      message: msg.slice(0, 500),
    });
    void capturePostHogEvent({
      event: "checkout_completion_exception",
      distinctId: correlationId ?? cartSuffix,
      properties: {
        stage: "complete_medusa_cart",
        httpStatus: 503,
        errorCode: "exception",
        message: msg.slice(0, 500),
      },
    });
    return jsonNoStore(
      { error: msg, code: "COMPLETE_EXCEPTION" },
      { status: 503 },
    );
  }
}

export const POST = withBotIdProtection(handlePOST);
