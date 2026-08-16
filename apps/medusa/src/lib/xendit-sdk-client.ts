const XENDIT_API = "https://api.xendit.co";

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function xenditFetch(
  secretKey: string,
  path: string,
  init: RequestInit,
): Promise<Response> {
  return fetch(`${XENDIT_API}${path}`, {
    ...init,
    headers: {
      Authorization: basicAuth(secretKey),
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

export type XenditClientOptions = {
  secretKey: string;
};

export type XenditCreateSessionInput = {
  amountMinor: number;
  currency: string;
  description: string;
  referenceId: string;
  successUrl: string;
  cancelUrl: string;
  sessionType?: "PAY" | "SAVE" | "PAY_AND_SAVE" | "SUBSCRIPTION";
  mode?: "PAYMENT_LINK" | "COMPONENTS";
  country?: string;
  allowedPaymentChannels?: string[];
  componentsOrigin?: string;
  allowSavePaymentMethod?: "DISABLED" | "OPTIONAL" | "FORCED";
  captureMethod?: "AUTOMATIC" | "MANUAL";
  idempotencyKey?: string;
  customer?: {
    referenceId: string;
    type?: "INDIVIDUAL" | "BUSINESS";
    email?: string;
    mobileNumber?: string;
    givenNames?: string;
    surname?: string;
  };
};

export type XenditCreateSessionResult = {
  sessionId: string;
  checkoutUrl?: string;
  componentsSdkKey?: string;
  paymentRequestId?: string;
  paymentId?: string;
  status?: string;
  paymentTokenId?: string;
};

export type XenditSessionStatus = {
  status: string;
  amountMinor?: number;
  paymentRequestId?: string;
  paymentId?: string;
  referenceId?: string;
  paymentTokenId?: string;
};

export type XenditRefundInput = {
  paymentRequestId: string;
  amountMinor: number;
  currency: string;
  reason?: string;
};

export async function createXenditPaymentSession(
  options: XenditClientOptions,
  input: XenditCreateSessionInput,
): Promise<XenditCreateSessionResult> {
  for (const [name, value] of [
    ["successUrl", input.successUrl],
    ["cancelUrl", input.cancelUrl],
  ] as const) {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`Xendit ${name} must be an absolute HTTPS URL.`);
    }
    if (url.protocol !== "https:") {
      throw new Error(`Xendit ${name} must be an absolute HTTPS URL.`);
    }
  }
  const mode = input.mode ?? "PAYMENT_LINK";
  const sessionType = input.sessionType ?? "PAY";
  const body: Record<string, unknown> = {
    session_type: sessionType,
    mode,
    reference_id: input.referenceId,
    amount: Math.round(input.amountMinor),
    currency: input.currency.toUpperCase(),
    country: (input.country ?? "PH").toUpperCase(),
    success_return_url: input.successUrl,
    cancel_return_url: input.cancelUrl,
    description: input.description,
    capture_method: input.captureMethod ?? "AUTOMATIC",
  };
  if (input.customer?.referenceId) {
    body.customer = {
      reference_id: input.customer.referenceId,
      type: input.customer.type ?? "INDIVIDUAL",
      ...(input.customer.email ? { email: input.customer.email } : {}),
      ...(input.customer.mobileNumber ? { mobile_number: input.customer.mobileNumber } : {}),
      ...(input.customer.givenNames || input.customer.surname
        ? { individual_detail: { given_names: input.customer.givenNames ?? "", surname: input.customer.surname ?? "" } }
        : {}),
    };
  }
  if (input.allowedPaymentChannels?.length) {
    body.allowed_payment_channels = input.allowedPaymentChannels;
  }
  if (mode === "COMPONENTS") {
    body.components_configuration = {
      origins: [input.componentsOrigin ?? new URL(input.successUrl).origin],
    };
  }
  if (input.allowSavePaymentMethod && sessionType === "PAY") {
    body.allow_save_payment_method = input.allowSavePaymentMethod;
  }
  const res = await xenditFetch(options.secretKey, "/sessions", {
    method: "POST",
    headers: input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : undefined,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xendit create session failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    id?: string;
    payment_session_id?: string;
    payment_link_url?: string;
    payment_request_id?: string;
    payment_id?: string;
    status?: string;
    components_sdk_key?: string;
    payment_token_id?: string;
  };
  const sessionId = (json.payment_session_id ?? json.id)?.trim();
  const checkoutUrl = json.payment_link_url?.trim() || undefined;
  const componentsSdkKey = json.components_sdk_key?.trim() || undefined;
  if (!sessionId || (mode === "PAYMENT_LINK" && !checkoutUrl) || (mode === "COMPONENTS" && !componentsSdkKey)) {
    throw new Error("Xendit response missing the session id or checkout surface key.");
  }
  return {
    sessionId,
    checkoutUrl,
    componentsSdkKey,
    paymentRequestId: json.payment_request_id?.trim() || undefined,
    paymentId: json.payment_id?.trim() || undefined,
    status: json.status?.trim() || undefined,
    paymentTokenId: json.payment_token_id?.trim() || undefined,
  };
}

export type XenditPaymentRequestInput = {
  referenceId: string;
  amountMinor: number;
  currency: string;
  country: string;
  channelCode: string;
  paymentTokenId?: string;
  captureMethod?: "AUTOMATIC" | "MANUAL";
  channelProperties?: Record<string, unknown>;
  metadata?: Record<string, string>;
  idempotencyKey?: string;
};

export async function createXenditPaymentRequest(
  options: XenditClientOptions,
  input: XenditPaymentRequestInput,
): Promise<{ paymentRequestId: string; paymentId?: string; status?: string; paymentTokenId?: string }> {
  const body: Record<string, unknown> = {
    reference_id: input.referenceId,
    type: "PAY",
    country: input.country.toUpperCase(),
    currency: input.currency.toUpperCase(),
    request_amount: Math.round(input.amountMinor),
    channel_code: input.channelCode,
    channel_properties: input.channelProperties ?? {},
    capture_method: input.captureMethod ?? "AUTOMATIC",
    ...(input.metadata ? { metadata: input.metadata } : {}),
    ...(input.paymentTokenId ? { payment_token_id: input.paymentTokenId } : {}),
  };
  const res = await xenditFetch(options.secretKey, "/v3/payment_requests", {
    method: "POST",
    headers: {
      "api-version": "2024-11-11",
      ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit payment request failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { payment_request_id?: string; payment_id?: string; status?: string; payment_token_id?: string };
  const paymentRequestId = json.payment_request_id?.trim();
  if (!paymentRequestId) throw new Error("Xendit response missing payment_request_id.");
  return { paymentRequestId, paymentId: json.payment_id?.trim() || undefined, status: json.status, paymentTokenId: json.payment_token_id?.trim() || undefined };
}

export type XenditPayoutInput = {
  referenceId: string;
  channelCode: string;
  amountMinor: number;
  currency: string;
  channelProperties: Record<string, unknown>;
  description?: string;
  idempotencyKey: string;
};

export async function createXenditPayout(
  options: XenditClientOptions,
  input: XenditPayoutInput,
): Promise<{ payoutId: string; status?: string }> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor < 1) {
    throw new Error("Xendit payout amount must be a positive integer in minor units.");
  }
  const res = await xenditFetch(options.secretKey, "/v3/payouts", {
    method: "POST",
    headers: {
      "api-version": "2025-09-01",
      "idempotency-key": input.idempotencyKey,
    },
    body: JSON.stringify({
      reference_id: input.referenceId,
      channel_code: input.channelCode,
      amount: input.amountMinor,
      currency: input.currency.toUpperCase(),
      channel_properties: input.channelProperties,
      ...(input.description ? { description: input.description } : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit payout failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { id?: string; payout_id?: string; status?: string };
  const payoutId = (json.payout_id ?? json.id)?.trim();
  if (!payoutId) throw new Error("Xendit payout response missing payout id.");
  return { payoutId, status: json.status?.toLowerCase() };
}

export async function chargeXenditPaymentToken(
  options: XenditClientOptions,
  input: XenditPaymentRequestInput & { paymentTokenId: string },
): Promise<{ paymentRequestId: string; paymentId?: string; status?: string }> {
  const token = await getXenditPaymentToken(options, input.paymentTokenId);
  if (!["active", "usable", "success"].includes(token.status)) {
    throw new Error(`Xendit payment token is not chargeable: ${token.status}`);
  }
  return createXenditPaymentRequest(options, {
    ...input,
    paymentTokenId: token.paymentTokenId,
  });
}

export async function getXenditPaymentSession(
  options: XenditClientOptions,
  sessionId: string,
): Promise<XenditSessionStatus> {
  const res = await xenditFetch(
    options.secretKey,
    `/sessions/${encodeURIComponent(sessionId)}`,
    { method: "GET" },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xendit retrieve session failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    id?: string;
    status?: string;
    reference_id?: string;
    amount?: number;
    payment_request_id?: string;
    payment_id?: string;
    data?: {
      reference_id?: string;
      payment_request_id?: string;
      payment_id?: string;
      amount?: number;
      status?: string;
    };
  };
  const data = json.data ?? {};
  return {
    status: (data.status ?? json.status ?? "").toLowerCase(),
    amountMinor: data.amount ?? json.amount,
    paymentRequestId:
      data.payment_request_id?.trim() || json.payment_request_id?.trim(),
    paymentId: data.payment_id?.trim() || json.payment_id?.trim(),
    referenceId: data.reference_id?.trim() || json.reference_id?.trim(),
  };
}

export async function getXenditPaymentRequest(
  options: XenditClientOptions,
  paymentRequestId: string,
): Promise<{ paymentRequestId: string; status: string; amountMinor?: number; currency?: string; referenceId?: string; paymentId?: string }> {
  const res = await xenditFetch(options.secretKey, `/v3/payment_requests/${encodeURIComponent(paymentRequestId)}`, {
    method: "GET",
    headers: { "api-version": "2024-11-11" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit retrieve payment request failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as { payment_request_id?: string; status?: string; request_amount?: number; currency?: string; reference_id?: string; payment_id?: string };
  if (!json.status) throw new Error("Xendit payment request response is incomplete.");
  return { paymentRequestId: json.payment_request_id?.trim() || paymentRequestId, status: json.status.toLowerCase(), amountMinor: json.request_amount, currency: json.currency, referenceId: json.reference_id, paymentId: json.payment_id };
}

export type XenditPaymentToken = {
  paymentTokenId: string;
  status: string;
  channelCode?: string;
  country?: string;
  currency?: string;
  customerId?: string;
  referenceId?: string;
};

export async function getXenditPaymentToken(
  options: XenditClientOptions,
  paymentTokenId: string,
): Promise<XenditPaymentToken> {
  const res = await xenditFetch(
    options.secretKey,
    `/v3/payment_tokens/${encodeURIComponent(paymentTokenId)}`,
    { method: "GET", headers: { "api-version": "2024-11-11" } },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit retrieve payment token failed: ${res.status} ${text}`);
  const json = JSON.parse(text) as {
    payment_token_id?: string;
    status?: string;
    channel_code?: string;
    country?: string;
    currency?: string;
    customer_id?: string;
    reference_id?: string;
  };
  const id = json.payment_token_id?.trim() || paymentTokenId.trim();
  if (!id || !json.status) throw new Error("Xendit payment token response is incomplete.");
  return {
    paymentTokenId: id,
    status: json.status.toLowerCase(),
    channelCode: json.channel_code,
    country: json.country,
    currency: json.currency,
    customerId: json.customer_id,
    referenceId: json.reference_id,
  };
}

export async function refundXenditPayment(
  options: XenditClientOptions,
  input: XenditRefundInput & { idempotencyKey?: string },
): Promise<void> {
  const res = await xenditFetch(options.secretKey, "/refunds", {
    method: "POST",
    headers: input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : undefined,
    body: JSON.stringify({
      payment_request_id: input.paymentRequestId,
      currency: input.currency.toUpperCase(),
      amount: Math.round(input.amountMinor),
      reason: input.reason ?? "requested_by_customer",
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Xendit refund failed: ${res.status} ${text}`);
  }
}

export async function captureXenditPayment(
  options: XenditClientOptions,
  input: { paymentId: string; amountMinor?: number; idempotencyKey?: string },
): Promise<void> {
  const res = await xenditFetch(
    options.secretKey,
    `/payments/${encodeURIComponent(input.paymentId)}/capture`,
    {
      method: "POST",
      headers: input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : undefined,
      body: JSON.stringify(
        typeof input.amountMinor === "number"
          ? { capture_amount: Math.round(input.amountMinor) }
          : {},
      ),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit capture failed: ${res.status} ${text}`);
}

export async function cancelXenditPayment(
  options: XenditClientOptions,
  paymentId: string,
  idempotencyKey?: string,
): Promise<void> {
  const res = await xenditFetch(
    options.secretKey,
    `/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      ...(idempotencyKey ? { headers: { "idempotency-key": idempotencyKey } } : {}),
      body: JSON.stringify({}),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`Xendit cancel failed: ${res.status} ${text}`);
}
