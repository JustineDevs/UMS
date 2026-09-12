export type ProviderFetch = typeof fetch;

export type StripeCheckoutInput = {
  secretKey: string;
  amountMinor: number;
  currency: string;
  productName: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  correlationId?: string;
  fetcher?: ProviderFetch;
};

export type HostedCheckoutResult = { id: string; url: string };

function requireNonEmpty(value: string, name: string): string {
  if (!value.trim()) throw new Error(`${name}_not_configured`);
  return value.trim();
}

function basicAuth(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

async function readJson(
  response: Response,
  provider: string,
): Promise<Record<string, unknown>> {
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      body = parsed as Record<string, unknown>;
  } catch {
    // Preserve a stable provider error when the upstream response is not JSON.
  }
  if (!response.ok)
    throw new Error(`${provider}_request_failed:${response.status}`);
  return body;
}

export async function createStripeCheckoutSession(
  input: StripeCheckoutInput,
): Promise<HostedCheckoutResult> {
  const amount = Math.trunc(input.amountMinor);
  const quantity = Math.trunc(input.quantity);
  if (!Number.isInteger(amount) || amount < 1)
    throw new Error("stripe_invalid_amount");
  if (!Number.isInteger(quantity) || quantity < 1)
    throw new Error("stripe_invalid_quantity");
  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][price_data][currency]": input.currency.toLowerCase(),
    "line_items[0][price_data][product_data][name]": input.productName,
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][quantity]": String(quantity),
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    ...(input.correlationId
      ? {
          client_reference_id: input.correlationId,
          "metadata[correlation_id]": input.correlationId,
        }
      : {}),
  });
  const response = await (input.fetcher ?? fetch)(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireNonEmpty(input.secretKey, "stripe_secret_key")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": requireNonEmpty(
          input.idempotencyKey,
          "stripe_idempotency_key",
        ),
      },
      body: form,
    },
  );
  const body = await readJson(response, "stripe");
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!id || !url) throw new Error("stripe_response_missing_checkout");
  return { id, url };
}

export type PayPalOrderInput = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  amountMajor: string;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  correlationId?: string;
  fetcher?: ProviderFetch;
};

async function paypalAccessToken(
  input: PayPalOrderInput,
  fetcher: ProviderFetch,
): Promise<string> {
  const base = input.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const response = await fetcher(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(
        requireNonEmpty(input.clientId, "paypal_client_id"),
        requireNonEmpty(input.clientSecret, "paypal_client_secret"),
      ),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const body = await readJson(response, "paypal");
  const token =
    typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!token) throw new Error("paypal_response_missing_access_token");
  return token;
}

export async function createPayPalOrder(
  input: PayPalOrderInput,
): Promise<HostedCheckoutResult> {
  const fetcher = input.fetcher ?? fetch;
  const base = input.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const token = await paypalAccessToken(input, fetcher);
  const response = await fetcher(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requireNonEmpty(
        input.idempotencyKey,
        "paypal_idempotency_key",
      ),
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: input.amountMajor,
          },
          ...(input.correlationId ? { custom_id: input.correlationId } : {}),
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        user_action: "PAY_NOW",
      },
    }),
  });
  const body = await readJson(response, "paypal");
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const links = Array.isArray(body.links) ? body.links : [];
  const approval = links.find(
    (link): link is { rel?: unknown; href?: unknown } =>
      Boolean(
        link &&
        typeof link === "object" &&
        !Array.isArray(link) &&
        (link as Record<string, unknown>).rel === "approve",
      ),
  );
  const url =
    approval && typeof approval.href === "string" ? approval.href.trim() : "";
  if (!id || !url) throw new Error("paypal_response_missing_approval");
  return { id, url };
}

export type PayPalConfirmationInput = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  orderId: string;
  expectedAmountMinor: number;
  expectedCurrency: string;
  idempotencyKey: string;
  fetcher?: ProviderFetch;
};

export async function confirmPayPalOrder(
  input: PayPalConfirmationInput,
): Promise<{ captureId: string; payload: Record<string, unknown> }> {
  const fetcher = input.fetcher ?? fetch;
  const orderId = requireNonEmpty(input.orderId, "paypal_order_id");
  const currency = input.expectedCurrency.trim().toUpperCase();
  if (!Number.isSafeInteger(input.expectedAmountMinor) || input.expectedAmountMinor < 1)
    throw new Error("paypal_invalid_expected_amount");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("paypal_invalid_currency");
  const base = input.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const token = await paypalAccessToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    sandbox: input.sandbox,
    amountMajor: "0",
    currency,
    returnUrl: "https://invalid.example/return",
    cancelUrl: "https://invalid.example/cancel",
    idempotencyKey: input.idempotencyKey,
    fetcher,
  }, fetcher);
  const retrieve = await fetcher(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let payload = await readJson(retrieve, "paypal");
  const status = String(payload.status ?? "").toUpperCase();
  if (status === "APPROVED" || status === "PAYER_ACTION_REQUIRED") {
    const capture = await fetcher(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requireNonEmpty(input.idempotencyKey, "paypal_idempotency_key"),
      },
      body: "{}",
    });
    payload = await readJson(capture, "paypal");
  }
  const unit = Array.isArray(payload.purchase_units) && payload.purchase_units[0] && typeof payload.purchase_units[0] === "object"
    ? payload.purchase_units[0] as Record<string, unknown>
    : {};
  const payments = unit.payments && typeof unit.payments === "object" ? unit.payments as Record<string, unknown> : {};
  const captures = Array.isArray(payments.captures) ? payments.captures : [];
  const capture = captures[0] && typeof captures[0] === "object" ? captures[0] as Record<string, unknown> : {};
  const amount = capture.amount && typeof capture.amount === "object" ? capture.amount as Record<string, unknown> : {};
  const captureId = typeof capture.id === "string" ? capture.id.trim() : "";
  const amountMinor = Math.round(Number(amount.value) * 100);
  if (String(capture.status ?? payload.status ?? "").toUpperCase() !== "COMPLETED" ||
      !captureId || amountMinor !== input.expectedAmountMinor || String(amount.currency_code ?? "").toUpperCase() !== currency) {
    throw new Error("paypal_payment_not_completed");
  }
  return { captureId, payload };
}

export type XenditSessionInput = {
  secretKey: string;
  referenceId: string;
  amountMinor: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  correlationId?: string;
  fetcher?: ProviderFetch;
};

export async function createXenditSession(
  input: XenditSessionInput,
): Promise<HostedCheckoutResult> {
  const response = await (input.fetcher ?? fetch)(
    "https://api.xendit.co/sessions",
    {
      method: "POST",
      headers: {
        Authorization: basicAuth(
          requireNonEmpty(input.secretKey, "xendit_secret_key"),
          "",
        ),
        "Content-Type": "application/json",
        "idempotency-key": requireNonEmpty(
          input.idempotencyKey,
          "xendit_idempotency_key",
        ),
      },
      body: JSON.stringify({
        session_type: "PAY",
        mode: "PAYMENT_LINK",
        reference_id: input.correlationId ?? input.referenceId,
        amount: Math.trunc(input.amountMinor),
        currency: input.currency.toUpperCase(),
        country: "PH",
        success_return_url: input.successUrl,
        cancel_return_url: input.cancelUrl,
      }),
    },
  );
  const body = await readJson(response, "xendit");
  const id =
    typeof (body.payment_session_id ?? body.id) === "string"
      ? String(body.payment_session_id ?? body.id).trim()
      : "";
  const url =
    typeof body.payment_link_url === "string"
      ? body.payment_link_url.trim()
      : "";
  if (!id || !url) throw new Error("xendit_response_missing_checkout");
  return { id, url };
}

export type StripeRefundInput = {
  secretKey: string;
  paymentIntentId?: string;
  chargeId?: string;
  amountMinor?: number;
  idempotencyKey: string;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
  fetcher?: ProviderFetch;
};

/** Provider-native refund primitives are kept separate from admin authorization and ledger writes. */
export async function refundStripePayment(
  input: StripeRefundInput,
): Promise<{ id: string; status: string }> {
  const target = input.paymentIntentId?.trim() || input.chargeId?.trim();
  if (!target) throw new Error("stripe_refund_target_required");
  if (input.amountMinor !== undefined && (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1)) {
    throw new Error("stripe_invalid_refund_amount");
  }
  const form = new URLSearchParams({
    ...(input.paymentIntentId ? { payment_intent: target } : { charge: target }),
    ...(input.amountMinor !== undefined ? { amount: String(input.amountMinor) } : {}),
    ...(input.reason ? { reason: input.reason } : {}),
  });
  const response = await (input.fetcher ?? fetch)("https://api.stripe.com/v1/refunds", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireNonEmpty(input.secretKey, "stripe_secret_key")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": requireNonEmpty(input.idempotencyKey, "stripe_refund_idempotency_key"),
    },
    body: form,
  });
  const body = await readJson(response, "stripe_refund");
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!id || !status) throw new Error("stripe_response_missing_refund");
  return { id, status };
}

export type PayPalRefundInput = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  captureId: string;
  amountMajor?: string;
  currency: string;
  idempotencyKey: string;
  fetcher?: ProviderFetch;
};

export async function refundPayPalCapture(
  input: PayPalRefundInput,
): Promise<{ id: string | null; status: string }> {
  const captureId = requireNonEmpty(input.captureId, "paypal_capture_id");
  const currency = input.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("paypal_invalid_currency");
  if (input.amountMajor !== undefined && !/^\d+(?:\.\d{1,3})?$/.test(input.amountMajor)) {
    throw new Error("paypal_invalid_refund_amount");
  }
  const fetcher = input.fetcher ?? fetch;
  const base = input.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const token = await paypalAccessToken({
    clientId: input.clientId,
    clientSecret: input.clientSecret,
    sandbox: input.sandbox,
    amountMajor: "0",
    currency,
    returnUrl: "https://invalid.example/return",
    cancelUrl: "https://invalid.example/cancel",
    idempotencyKey: input.idempotencyKey,
    fetcher,
  }, fetcher);
  const response = await fetcher(`${base}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requireNonEmpty(input.idempotencyKey, "paypal_refund_idempotency_key"),
    },
    body: JSON.stringify(input.amountMajor === undefined ? {} : {
      amount: { value: input.amountMajor, currency_code: currency },
    }),
  });
  const body = await readJson(response, "paypal_refund");
  const status = typeof body.status === "string" ? body.status.trim() : "";
  if (!status) throw new Error("paypal_response_missing_refund_status");
  return { id: typeof body.id === "string" ? body.id.trim() || null : null, status };
}

export type XenditRefundInput = {
  secretKey: string;
  paymentRequestId: string;
  amountMinor: number;
  currency: string;
  idempotencyKey: string;
  reason?: string;
  fetcher?: ProviderFetch;
};

export async function refundXenditPayment(
  input: XenditRefundInput,
): Promise<{ id: string | null; status: string | null }> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1) {
    throw new Error("xendit_invalid_refund_amount");
  }
  if (!/^[A-Z]{3}$/i.test(input.currency.trim())) throw new Error("xendit_invalid_currency");
  const response = await (input.fetcher ?? fetch)("https://api.xendit.co/refunds", {
    method: "POST",
    headers: {
      Authorization: basicAuth(requireNonEmpty(input.secretKey, "xendit_secret_key"), ""),
      "Content-Type": "application/json",
      "idempotency-key": requireNonEmpty(input.idempotencyKey, "xendit_refund_idempotency_key"),
    },
    body: JSON.stringify({
      payment_request_id: requireNonEmpty(input.paymentRequestId, "xendit_payment_request_id"),
      currency: input.currency.toUpperCase(),
      amount: input.amountMinor,
      reason: input.reason ?? "requested_by_customer",
    }),
  });
  const body = await readJson(response, "xendit_refund");
  return {
    id: typeof body.refund_id === "string" ? body.refund_id.trim() || null : typeof body.id === "string" ? body.id.trim() || null : null,
    status: typeof body.status === "string" ? body.status.trim() || null : null,
  };
}

export type PancakeOrderInput = {
  apiUrl: string;
  apiKey: string;
  shopId: string;
  orderNumber: string;
  totalQuantity: number;
  fetcher?: ProviderFetch;
};

export async function createPancakeOrder(
  input: PancakeOrderInput,
): Promise<{ id: string }> {
  const url = new URL(
    `/shops/${encodeURIComponent(requireNonEmpty(input.shopId, "pancake_shop_id"))}/orders`,
    input.apiUrl,
  );
  url.searchParams.set(
    "api_key",
    requireNonEmpty(input.apiKey, "pancake_api_key"),
  );
  const response = await (input.fetcher ?? fetch)(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      order_number: input.orderNumber,
      external_order_number: input.orderNumber,
      total_quantity: String(Math.max(1, Math.trunc(input.totalQuantity))),
    }),
  });
  const body = await readJson(response, "pancake");
  const nested =
    body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {};
  const id =
    [body.order_id, body.orderId, nested.order_id, nested.orderId]
      .find(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      )
      ?.trim() ?? "";
  if (!id) throw new Error("pancake_response_missing_order");
  return { id };
}
