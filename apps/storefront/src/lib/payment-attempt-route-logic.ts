import { logCommerceObservabilityServer } from "@/lib/commerce-observability";
import { buildTrackingUrl, DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";

export type JsonRouteResult<T extends Record<string, unknown> = Record<string, unknown>> = {
  status: number;
  body: T;
};

type PaymentAttemptRouteRow = {
  cart_id: string;
  correlation_id: string;
  provider: string;
  provider_session_id?: string | null;
  provider_payment_id?: string | null;
  status?: string;
  webhook_last_status?: string | null;
  checkout_state?: string;
  medusa_order_id?: string | null;
  order_id?: string | null;
  quote_fingerprint?: string | null;
  stale_reason?: string | null;
};

export type FinalizeMedusaCartResult =
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

type RegisterCheckoutIntentInput = {
  organizationId?: string;
  cartId: string | null;
  provider: string;
  amountMinor: number;
  currencyCode: string;
  quoteFingerprint?: string;
  variantIds?: string[];
  productIds?: string[];
  medusaPaymentSessionId?: string;
  providerSessionId?: string;
  providerPaymentId?: string;
  idempotencyKey?: string;
  supabaseAvailable: boolean;
  registerPaymentAttempt: (_input: {
    organizationId?: string;
    cartId: string;
    provider: string;
      amountMinor: number;
      currencyCode: string;
      quoteFingerprint?: string;
      variantIds?: string[];
      productIds?: string[];
      medusaPaymentSessionId?: string;
      providerSessionId?: string;
      providerPaymentId?: string;
      idempotencyKey?: string;
  }) => Promise<{ correlationId: string; reused: boolean }>;
};

type FinalizeCheckoutIntentInput = {
  correlationId: string;
  cartId: string | null;
  row: PaymentAttemptRouteRow | null;
  currentQuoteFingerprint?: string | null;
  incrementFinalizeAttempts: (_correlationId: string) => Promise<void>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  verifyProviderPayment?: () => Promise<boolean>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  finalizeMedusaCart: (_cartId: string) => Promise<FinalizeMedusaCartResult>;
  logEvent: (_payload: unknown) => void;
  nowIso: () => string;
};

type CodPlaceOrderInput = {
  correlationId: string;
  cartId: string | null;
  row: PaymentAttemptRouteRow | null;
  currentQuoteFingerprint?: string | null;
  incrementFinalizeAttempts: (_correlationId: string) => Promise<void>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  finalizeMedusaCart: (_cartId: string) => Promise<FinalizeMedusaCartResult>;
  logEvent: (_payload: unknown) => void;
  nowIso: () => string;
};

const STALE_CHECKOUT_ERROR =
  "Your order changed before payment could be completed. Review the updated total before continuing.";
const LEGACY_CHECKOUT_ERROR =
  "This checkout session is outdated and needs a fresh review before payment can continue.";
const MISSING_CHECKOUT_ATTEMPT_ERROR =
  "This checkout session could not be found. Start checkout again before completing payment.";
const WRONG_CHECKOUT_ATTEMPT_PROVIDER_ERROR =
  "This payment session belongs to cash on delivery. Use the COD completion flow instead.";
const START_QUOTE_CHANGED_ERROR =
  "Your order changed before payment could be started. Review the updated total before continuing.";
const PAYMENT_NOT_VERIFIED_ERROR =
  "Payment has not been verified by the provider yet. We will keep checking and will not create an order until confirmation arrives.";
const PAYMENT_PENDING_ERROR =
  "Payment is still processing. We will keep checking and will not create an order until confirmation arrives.";

function paymentFailureBody(
  correlationId: string,
  error: string,
  code?: string,
): Record<string, unknown> {
  return {
    error,
    ...(code ? { code } : {}),
    correlationId: correlationId.trim() || null,
  };
}

const PROVIDER_AUTHORIZED_STATUSES = new Set([
  "authorized",
  "captured",
  "paid",
  "paid_awaiting_order",
]);
const PROVIDER_PENDING_STATUSES = new Set([
  "pending",
  "processing",
  "requires_action",
  "requires_capture",
]);

function providerPaymentIsAuthorized(row: PaymentAttemptRouteRow): boolean {
  return [row.status, row.webhook_last_status]
    .filter((value): value is string => typeof value === "string")
    .some((value) => PROVIDER_AUTHORIZED_STATUSES.has(value.trim().toLowerCase()));
}

function providerPaymentIsPending(row: PaymentAttemptRouteRow): boolean {
  return [row.status, row.webhook_last_status]
    .filter((value): value is string => typeof value === "string")
    .some((value) => PROVIDER_PENDING_STATUSES.has(value.trim().toLowerCase()));
}

function completedOrderResult(row: PaymentAttemptRouteRow): JsonRouteResult | null {
  const orderId = row.medusa_order_id?.trim() || row.order_id?.trim();
  if (row.status !== "completed" || !orderId) return null;
  const trackingUrl = buildTrackingUrl(
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN,
    orderId,
    { storeId: process.env.DEFAULT_ORGANIZATION_ID?.trim() },
  );
  if (!trackingUrl) return null;
  return {
    status: 200,
    body: {
      ok: true,
      orderId,
      redirectUrl: trackingUrl,
      replayed: true,
    },
  };
}

export function reconcileCheckoutIntentQuote(input: {
  submittedQuoteFingerprint?: string;
  authoritativeQuoteFingerprint: string;
}): JsonRouteResult<{ error: string; code: string; quoteFingerprint: string }> | null {
  const submitted = input.submittedQuoteFingerprint?.trim();
  if (!submitted || submitted === input.authoritativeQuoteFingerprint) {
    return null;
  }

  return {
    status: 409,
    body: {
      error: START_QUOTE_CHANGED_ERROR,
      code: "QUOTE_CHANGED",
      quoteFingerprint: input.authoritativeQuoteFingerprint,
    },
  };
}

async function expireAttemptForQuoteMismatch(input: {
  correlationId: string;
  row: PaymentAttemptRouteRow | null;
  currentQuoteFingerprint?: string | null;
  updatePaymentAttempt: (_correlationId: string, _patch: Record<string, unknown>) => Promise<void>;
  nowIso: () => string;
}): Promise<string | null> {
  if (input.row?.status === "expired") {
    return input.row.stale_reason?.trim() || STALE_CHECKOUT_ERROR;
  }
  if (input.row && !input.row.quote_fingerprint?.trim()) {
    await input.updatePaymentAttempt(input.correlationId, {
      status: "expired",
      checkout_state: "needs_review",
      stale_reason: LEGACY_CHECKOUT_ERROR,
      invalidated_at: input.nowIso(),
      invalidated_by: "missing_quote_fingerprint",
      last_error: LEGACY_CHECKOUT_ERROR,
    });
    logCommerceObservabilityServer("payment_session_invalidated", {
      correlationId: input.correlationId,
      reason: "missing_quote_fingerprint",
    });
    return LEGACY_CHECKOUT_ERROR;
  }
  if (
    !input.currentQuoteFingerprint?.trim() ||
    input.row?.quote_fingerprint?.trim() === input.currentQuoteFingerprint.trim()
  ) {
    return null;
  }
  const message = input.row?.stale_reason?.trim() || STALE_CHECKOUT_ERROR;
  await input.updatePaymentAttempt(input.correlationId, {
    status: "expired",
    checkout_state: "needs_review",
    stale_reason: message,
    invalidated_at: input.nowIso(),
    invalidated_by: "quote_fingerprint",
    last_error: message,
  });
  logCommerceObservabilityServer("payment_session_invalidated", {
    correlationId: input.correlationId,
    reason: "quote_fingerprint",
    previousFingerprint: input.row?.quote_fingerprint?.trim() ?? null,
    currentFingerprint: input.currentQuoteFingerprint?.trim() ?? null,
  });
  return message;
}

type InternalReconcileInput = {
  configuredSecret: string;
  providedSecret: string;
  correlationId: string;
  row: PaymentAttemptRouteRow | null;
  supabaseAvailable: boolean;
  finalizeMedusaCart: (_cartId: string) => Promise<FinalizeMedusaCartResult>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  nowIso: () => string;
};

type FinalizePaymentAttemptsCronInput = {
  configuredSecret: string;
  providedSecret: string;
  supabaseAvailable: boolean;
  stuckRows: Array<{ correlation_id: string; cart_id: string }>;
  claimFinalizeAttempt?: (_correlationId: string) => Promise<boolean>;
  finalizeMedusaCart: (_cartId: string) => Promise<FinalizeMedusaCartResult>;
  updatePaymentAttempt: (
    _correlationId: string,
    _patch: Record<string, unknown>,
  ) => Promise<void>;
  nowIso: () => string;
};

export async function registerCheckoutIntentRouteLogic(
  input: RegisterCheckoutIntentInput,
): Promise<JsonRouteResult> {
  if (!input.cartId) {
    return { status: 400, body: { error: "No active cart" } };
  }

  if (!input.provider.trim()) {
    return { status: 400, body: { error: "provider is required" } };
  }

  if (!input.quoteFingerprint?.trim()) {
    return { status: 400, body: { error: "quoteFingerprint is required" } };
  }

  if (!input.supabaseAvailable) {
    return {
      status: 503,
      body: { error: "Payment ledger is not configured" },
    };
  }

  try {
    const { correlationId, reused } = await input.registerPaymentAttempt({
      organizationId: input.organizationId,
      cartId: input.cartId,
      provider: input.provider,
      amountMinor: input.amountMinor,
      currencyCode: input.currencyCode,
      quoteFingerprint: input.quoteFingerprint,
      variantIds: input.variantIds,
      productIds: input.productIds,
      medusaPaymentSessionId: input.medusaPaymentSessionId,
      providerSessionId: input.providerSessionId,
      providerPaymentId: input.providerPaymentId,
      idempotencyKey: input.idempotencyKey,
    });

    return {
      status: 200,
      body: {
        correlationId,
        cartId: input.cartId,
        reused,
      },
    };
  } catch (error) {
    return {
      status: 503,
      body: {
        error:
          error instanceof Error ? error.message : "Register failed",
      },
    };
  }
}

export async function finalizeCheckoutIntentRouteLogic(
  input: FinalizeCheckoutIntentInput,
): Promise<JsonRouteResult> {
  if (!input.correlationId.trim()) {
    return { status: 400, body: { error: "Missing correlation id" } };
  }

  if (!input.cartId) {
    input.logEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 400,
      errorCode: "no_cart",
      message: "No active cart",
    });
    return { status: 400, body: { error: "No active cart" } };
  }

  if (!input.row) {
    input.logEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 404,
      errorCode: "missing_attempt",
      message: MISSING_CHECKOUT_ATTEMPT_ERROR,
    });
    return { status: 404, body: { error: MISSING_CHECKOUT_ATTEMPT_ERROR } };
  }

  if (input.row.cart_id !== input.cartId) {
    return { status: 403, body: { error: "Cart mismatch" } };
  }

  if (input.row.provider === "cod") {
    return { status: 400, body: { error: WRONG_CHECKOUT_ATTEMPT_PROVIDER_ERROR } };
  }

  const completed = completedOrderResult(input.row);
  if (completed) return completed;

  const staleMismatchMessage = await expireAttemptForQuoteMismatch({
    correlationId: input.correlationId,
    row: input.row,
    currentQuoteFingerprint: input.currentQuoteFingerprint,
    updatePaymentAttempt: input.updatePaymentAttempt,
    nowIso: input.nowIso,
  });
  if (staleMismatchMessage) {
    return { status: 409, body: { error: staleMismatchMessage } };
  }

  let providerVerified = providerPaymentIsAuthorized(input.row);
  if (!providerVerified && input.verifyProviderPayment) {
    try {
      providerVerified = await input.verifyProviderPayment();
    } catch {
      providerVerified = false;
    }
  }
  if (!providerVerified) {
    const pending = providerPaymentIsPending(input.row);
    if (pending) {
      await input.updatePaymentAttempt(input.correlationId, {
        status: "pending_payment",
        checkout_state: "awaiting_provider",
        last_error: null,
      });
    }
    input.logEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 409,
      errorCode: pending ? "provider_payment_pending" : "provider_payment_not_verified",
      message: pending ? PAYMENT_PENDING_ERROR : PAYMENT_NOT_VERIFIED_ERROR,
    });
    return {
      status: 409,
      body: paymentFailureBody(
        input.correlationId,
        pending ? PAYMENT_PENDING_ERROR : PAYMENT_NOT_VERIFIED_ERROR,
        pending ? "PAYMENT_PENDING" : "PAYMENT_NOT_VERIFIED",
      ),
    };
  }

  if (!providerPaymentIsAuthorized(input.row)) {
    await input.updatePaymentAttempt(input.correlationId, {
      status: "paid",
      checkout_state: "provider_verified",
      webhook_last_status: "paid",
    });
  }

  try {
    const claimed = input.claimFinalizeAttempt
      ? await input.claimFinalizeAttempt(input.correlationId)
      : (await input.incrementFinalizeAttempts(input.correlationId), true);
    if (!claimed) {
      const completedAfterClaim = completedOrderResult(input.row);
      return completedAfterClaim ?? {
        status: 409,
        body: paymentFailureBody(
          input.correlationId,
          "Checkout finalization is already in progress",
          "FINALIZE_IN_PROGRESS",
        ),
      };
    }
  } catch {
    return {
      status: 503,
      body: paymentFailureBody(
        input.correlationId,
        "Payment finalization is temporarily unavailable",
        "FINALIZE_UNAVAILABLE",
      ),
    };
  }

  try {
    const result = await input.finalizeMedusaCart(input.cartId);
    if (!result.ok) {
      await input.updatePaymentAttempt(input.correlationId, {
        status: "paid_awaiting_order",
        checkout_state: "awaiting_completion",
        last_error: result.error.slice(0, 2000),
      });
      input.logEvent({
        stage: "complete_medusa_cart",
        outcome: "failure",
        httpStatus: result.status,
        attempts: result.attempts,
        errorCode: "order_not_ready",
        message: result.error.slice(0, 500),
      });
      return {
        status: result.status,
        body: paymentFailureBody(input.correlationId, result.error, "ORDER_NOT_READY"),
      };
    }

    await input.updatePaymentAttempt(input.correlationId, {
      status: "completed",
      checkout_state: "completed",
      medusa_order_id: result.orderId,
      order_id: result.orderId,
      last_error: null,
      finalized_at: input.nowIso(),
    });

    input.logEvent({
      stage: "complete_medusa_cart",
      outcome: "success",
      httpStatus: 200,
      orderId: result.orderId,
      attempts: result.attempts,
    });

    logCommerceObservabilityServer("payment_session_completed", {
      correlationId: input.correlationId,
      cartId: input.cartId,
      orderId: result.orderId,
      stage: "finalize_complete",
    });

    return {
      status: 200,
      body: {
        ok: true,
        orderId: result.orderId,
        redirectUrl: result.redirectUrl,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Complete failed";
    await input.updatePaymentAttempt(input.correlationId, {
      last_error: message.slice(0, 2000),
      status: "needs_review",
      checkout_state: "needs_review",
    });
    input.logEvent({
      stage: "complete_medusa_cart",
      outcome: "failure",
      httpStatus: 503,
      errorCode: "exception",
      message: message.slice(0, 500),
    });
    return {
      status: 503,
      body: paymentFailureBody(input.correlationId, message, "FINALIZE_EXCEPTION"),
    };
  }
}

export async function codPlaceOrderRouteLogic(
  input: CodPlaceOrderInput,
): Promise<JsonRouteResult> {
  if (!input.cartId) {
    return { status: 400, body: { error: "No active cart" } };
  }

  if (!input.correlationId.trim()) {
    return { status: 400, body: { error: "correlationId is required" } };
  }

  if (!input.row) {
    return { status: 404, body: { error: MISSING_CHECKOUT_ATTEMPT_ERROR } };
  }

  if (input.row.cart_id !== input.cartId) {
    return { status: 403, body: { error: "Cart mismatch" } };
  }

  if (input.row.provider !== "cod") {
    return { status: 400, body: { error: "Not a COD attempt" } };
  }

  const completed = completedOrderResult(input.row);
  if (completed) return completed;

  const staleMismatchMessage = await expireAttemptForQuoteMismatch({
    correlationId: input.correlationId,
    row: input.row,
    currentQuoteFingerprint: input.currentQuoteFingerprint,
    updatePaymentAttempt: input.updatePaymentAttempt,
    nowIso: input.nowIso,
  });
  if (staleMismatchMessage) {
    return { status: 409, body: { error: staleMismatchMessage } };
  }

  try {
    const claimed = input.claimFinalizeAttempt
      ? await input.claimFinalizeAttempt(input.correlationId)
      : (await input.incrementFinalizeAttempts(input.correlationId), true);
    if (!claimed) {
      const completedAfterClaim = completedOrderResult(input.row);
      return completedAfterClaim ?? {
        status: 409,
        body: { error: "Checkout finalization is already in progress" },
      };
    }
  } catch {
    return { status: 503, body: { error: "Order placement is temporarily unavailable" } };
  }

  try {
    const result = await input.finalizeMedusaCart(input.cartId);
    if (!result.ok) {
      await input.updatePaymentAttempt(input.correlationId, {
        status: "paid_awaiting_order",
        checkout_state: "awaiting_completion",
        last_error: result.error.slice(0, 2000),
      });
      input.logEvent({
        stage: "cod_place_order",
        outcome: "failure",
        httpStatus: result.status,
        errorCode: "order_not_ready",
        message: result.error.slice(0, 500),
      });
      return { status: result.status, body: { error: result.error } };
    }

    await input.updatePaymentAttempt(input.correlationId, {
      status: "completed",
      checkout_state: "completed",
      medusa_order_id: result.orderId,
      order_id: result.orderId,
      last_error: null,
      finalized_at: input.nowIso(),
    });

    input.logEvent({
      stage: "cod_place_order",
      outcome: "success",
      httpStatus: 200,
      orderId: result.orderId,
    });

    logCommerceObservabilityServer("payment_session_completed", {
      correlationId: input.correlationId,
      cartId: input.cartId,
      orderId: result.orderId,
      stage: "cod_place_order",
    });

    return {
      status: 200,
      body: {
        ok: true,
        orderId: result.orderId,
        redirectUrl: result.redirectUrl,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Complete failed";
    await input.updatePaymentAttempt(input.correlationId, {
      last_error: message.slice(0, 2000),
      status: "needs_review",
      checkout_state: "needs_review",
    });
    input.logEvent({
      stage: "cod_place_order",
      outcome: "failure",
      httpStatus: 503,
      errorCode: "exception",
      message: message.slice(0, 500),
    });
    return { status: 503, body: { error: message } };
  }
}

export async function internalReconcilePaymentAttemptRouteLogic(
  input: InternalReconcileInput,
): Promise<JsonRouteResult> {
  if (!input.configuredSecret || input.providedSecret !== input.configuredSecret) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!input.correlationId.trim()) {
    return { status: 400, body: { error: "correlationId required" } };
  }

  if (!input.supabaseAvailable) {
    return { status: 503, body: { error: "Supabase not configured" } };
  }

  if (!input.row) {
    return { status: 404, body: { error: "Not found" } };
  }

  const result = await input.finalizeMedusaCart(input.row.cart_id);
  if (!result.ok) {
    await input.updatePaymentAttempt(input.correlationId, {
      status: "paid_awaiting_order",
      checkout_state: "awaiting_completion",
      last_error: result.error.slice(0, 2000),
    });
    return { status: result.status, body: { ok: false, error: result.error } };
  }

  await input.updatePaymentAttempt(input.correlationId, {
    status: "completed",
    checkout_state: "completed",
    medusa_order_id: result.orderId,
    order_id: result.orderId,
    last_error: null,
    finalized_at: input.nowIso(),
  });

  logCommerceObservabilityServer("payment_session_recovered", {
    correlationId: input.correlationId,
    cartId: input.row.cart_id,
    orderId: result.orderId,
    stage: "internal_reconcile",
  });

  return {
    status: 200,
    body: { ok: true, orderId: result.orderId, redirectUrl: result.redirectUrl },
  };
}

export async function finalizePaymentAttemptsCronRouteLogic(
  input: FinalizePaymentAttemptsCronInput,
): Promise<JsonRouteResult> {
  if (!input.configuredSecret || input.providedSecret !== input.configuredSecret) {
    return { status: 401, body: { error: "Unauthorized" } };
  }

  if (!input.supabaseAvailable) {
    return { status: 503, body: { error: "Supabase not configured" } };
  }

  let processed = 0;
  let completed = 0;
  const errors: string[] = [];

  for (const row of input.stuckRows) {
    processed += 1;
    const claimed = input.claimFinalizeAttempt
      ? await input.claimFinalizeAttempt(row.correlation_id)
      : true;
    if (!claimed) continue;
    const result = await input.finalizeMedusaCart(row.cart_id);
    if (result.ok) {
      completed += 1;
      await input.updatePaymentAttempt(row.correlation_id, {
        status: "completed",
        checkout_state: "completed",
        medusa_order_id: result.orderId,
        order_id: result.orderId,
        last_error: null,
        finalized_at: input.nowIso(),
      });
      continue;
    }

    errors.push(`${row.correlation_id}: ${result.error}`);
    await input.updatePaymentAttempt(row.correlation_id, {
      last_error: result.error.slice(0, 2000),
    });
  }

  return { status: 200, body: { ok: true, processed, completed, errors } };
}
