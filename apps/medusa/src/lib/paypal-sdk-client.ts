import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaypalExperienceUserAction,
  type Order,
  type OrderAuthorizeResponse,
  type OrderRequest,
} from "@paypal/paypal-server-sdk";

const PAYPAL_TIMEOUT_MS = 30_000;

export type PayPalClientOptions = {
  clientId: string;
  clientSecret: string;
  sandbox: boolean;
  accessToken?: string;
  nangoApiKey?: string;
  nangoConnectionId?: string;
  nangoProviderConfigKey?: string;
};

type PayPalClientInstance = InstanceType<typeof Client>;

let _cachedClient: { key: string; client: PayPalClientInstance } | null = null;

function getPayPalClient(options: PayPalClientOptions): PayPalClientInstance {
  const key = `${options.clientId}:${options.sandbox}`;
  if (_cachedClient?.key === key) {
    return _cachedClient.client;
  }
  const client = new Client({
    timeout: PAYPAL_TIMEOUT_MS,
    environment: options.sandbox
      ? Environment.Sandbox
      : Environment.Production,
    clientCredentialsAuthCredentials: {
      oAuthClientId: options.clientId,
      oAuthClientSecret: options.clientSecret,
    },
  });
  _cachedClient = { key, client };
  return client;
}

export async function createPayPalOrder(
  options: PayPalClientOptions,
  input: {
    sessionId: string;
    amountMajor: string;
    currencyCode: string;
    returnUrl: string;
    cancelUrl: string;
    intent?: CheckoutPaymentIntent;
  },
): Promise<{ orderId: string; approvalUrl: string }> {
  if (options.accessToken) {
    const response = await payPalRestJson(options, "/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({
        intent: input.intent === CheckoutPaymentIntent.Authorize ? "AUTHORIZE" : "CAPTURE",
        purchase_units: [{
          custom_id: input.sessionId.slice(0, 127),
          amount: { currency_code: input.currencyCode, value: input.amountMajor },
        }],
        payment_source: { paypal: { experience_context: { return_url: input.returnUrl, cancel_url: input.cancelUrl, user_action: "PAY_NOW" } } },
      }),
    }) as { id?: string; links?: Array<{ rel?: string; href?: string }> };
    const orderId = response.id;
    const approvalUrl = response.links?.find((link) => link.rel === "approve" || link.rel === "payer-action")?.href;
    if (!orderId || !approvalUrl) throw new Error("PayPal create order response missing id or approve link.");
    return { orderId, approvalUrl };
  }
  const client = getPayPalClient(options);
  const ordersController = new OrdersController(client);

  const body: OrderRequest = {
    intent: input.intent ?? CheckoutPaymentIntent.Capture,
    purchaseUnits: [
      {
        customId: input.sessionId.slice(0, 127),
        amount: {
          currencyCode: input.currencyCode,
          value: input.amountMajor,
        },
      },
    ],
    paymentSource: {
      paypal: {
        experienceContext: {
          returnUrl: input.returnUrl,
          cancelUrl: input.cancelUrl,
          userAction: PaypalExperienceUserAction.PayNow,
        },
      },
    },
  };

  const { result } = await ordersController.createOrder({ body });

  const orderId = result.id;
  const approvalLink = result.links?.find(
    (l) => l.rel === "approve" || l.rel === "payer-action",
  );
  const approvalUrl = approvalLink?.href;

  if (!orderId || !approvalUrl) {
    throw new Error("PayPal create order response missing id or approve link.");
  }

  return { orderId, approvalUrl };
}

export async function authorizePayPalOrder(
  options: PayPalClientOptions,
  orderId: string,
  requestId: string,
): Promise<{
  status: string;
  authorizationId?: string;
  response: OrderAuthorizeResponse;
}> {
  if (options.accessToken) {
    const result = await payPalRestJson(options, `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {
      method: "POST",
      headers: { "PayPal-Request-Id": requestId, Prefer: "return=representation" },
      body: "{}",
    }) as Order;
    return {
      status: (result.status ?? "").toUpperCase(),
      authorizationId: result.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id,
      response: result as OrderAuthorizeResponse,
    };
  }
  const client = getPayPalClient(options);
  const ordersController = new OrdersController(client);
  const { result } = await ordersController.authorizeOrder({
    id: orderId,
    paypalRequestId: requestId,
    prefer: "return=representation",
  });
  const authorizationId = result.purchaseUnits?.[0]?.payments?.authorizations?.[0]?.id;
  return {
    status: (result.status ?? "").toUpperCase(),
    authorizationId,
    response: result,
  };
}

export async function capturePayPalOrder(
  options: PayPalClientOptions,
  orderId: string,
  input?: {
    amountMajor?: string;
    currencyCode?: string;
    requestId?: string;
    finalCapture?: boolean;
  },
): Promise<{
  status: string;
  captureAmountMinor: number | undefined;
  captureId: string | undefined;
}> {
  let result: Order;
  if (input?.amountMajor != null && hasNangoProxy(options)) {
    result = await payPalRestJson(options, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { ...(input.requestId ? { "PayPal-Request-Id": input.requestId } : {}), Prefer: "return=representation" },
      body: JSON.stringify({
        amount: {
          currency_code: String(input.currencyCode ?? "PHP").toUpperCase(),
          value: input.amountMajor,
        },
        final_capture: input.finalCapture ?? true,
      }),
    }) as Order;
  } else if (input?.amountMajor != null) {
    const base = options.sandbox
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
    const token = await payPalRestToken(options);
    const res = await fetch(
      `${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(input.requestId ? { "PayPal-Request-Id": input.requestId } : {}),
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          payment_source: undefined,
          amount: {
            currency_code: String(input.currencyCode ?? "PHP").toUpperCase(),
            value: input.amountMajor,
          },
          final_capture: input.finalCapture ?? true,
        }),
      },
    );
    const text = await res.text();
    if (!res.ok) throw new Error(`PayPal capture failed: ${res.status} ${text}`);
    result = JSON.parse(text) as Order;
  } else if (options.accessToken) {
    result = await payPalRestJson(options, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: { ...(input?.requestId ? { "PayPal-Request-Id": input.requestId } : {}), Prefer: "return=representation" },
      body: "{}",
    }) as Order;
  } else {
    const client = getPayPalClient(options);
    const ordersController = new OrdersController(client);
    const response = await ordersController.captureOrder({
      id: orderId,
      paypalRequestId: input?.requestId,
      prefer: "return=representation",
    });
    result = response.result;
  }

  const status = (result.status ?? "").toUpperCase();
  const capture = result.purchaseUnits?.[0]?.payments?.captures?.[0];
  const captureAmount = capture?.amount?.value;
  const amountMinor =
    captureAmount != null
      ? Math.round(parseFloat(String(captureAmount)) * 100)
      : undefined;
  const captureId = capture?.id;

  return { status, captureAmountMinor: amountMinor, captureId };
}

export async function voidPayPalAuthorization(
  options: PayPalClientOptions,
  authorizationId: string,
  requestId: string,
): Promise<void> {
  if (hasNangoProxy(options)) {
    await payPalRestJson(options, `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, {
      method: "POST",
      headers: { "PayPal-Request-Id": requestId },
    });
    return;
  }
  const base = options.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const token = await payPalRestToken(options);
  const res = await fetch(
    `${base}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": requestId,
      },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal authorization void failed: ${res.status} ${text}`);
  }
}

export async function capturePayPalAuthorization(
  options: PayPalClientOptions,
  authorizationId: string,
  input?: {
    amountMajor?: string;
    currencyCode?: string;
    requestId?: string;
    finalCapture?: boolean;
  },
): Promise<{ status: string; captureAmountMinor?: number; captureId?: string }> {
  if (hasNangoProxy(options)) {
    const result = await payPalRestJson(options, `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
      method: "POST",
      headers: { ...(input?.requestId ? { "PayPal-Request-Id": input.requestId } : {}), Prefer: "return=representation" },
      ...(input?.amountMajor != null ? {
        body: JSON.stringify({
          amount: {
            currency_code: String(input.currencyCode ?? "PHP").toUpperCase(),
            value: input.amountMajor,
          },
          final_capture: input.finalCapture ?? true,
        }),
      } : {}),
    }) as { status?: string; id?: string; amount?: { value?: string } };
    const value = Number(result.amount?.value);
    return {
      status: String(result.status ?? "").toUpperCase(),
      ...(result.id ? { captureId: result.id } : {}),
      ...(Number.isFinite(value) ? { captureAmountMinor: Math.round(value * 100) } : {}),
    };
  }
  const base = options.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const token = await payPalRestToken(options);
  const body = input?.amountMajor != null
    ? {
        amount: {
          currency_code: String(input.currencyCode ?? "PHP").toUpperCase(),
          value: input.amountMajor,
        },
        final_capture: input.finalCapture ?? true,
      }
    : undefined;
  const response = await fetch(
    `${base}/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(input?.requestId ? { "PayPal-Request-Id": input.requestId } : {}),
        Prefer: "return=representation",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  const text = await response.text();
  if (!response.ok) throw new Error(`PayPal authorization capture failed: ${response.status} ${text}`);
  const result = text ? JSON.parse(text) as { status?: string; id?: string; amount?: { value?: string } } : {};
  const value = Number(result.amount?.value);
  return {
    status: String(result.status ?? "").toUpperCase(),
    ...(result.id ? { captureId: result.id } : {}),
    ...(Number.isFinite(value) ? { captureAmountMinor: Math.round(value * 100) } : {}),
  };
}

async function payPalRestToken(options: PayPalClientOptions): Promise<string> {
  if (options.accessToken?.trim()) return options.accessToken.trim();
  const base = options.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) {
    throw new Error(`PayPal OAuth failed: ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("PayPal OAuth response missing access_token.");
  }
  return tokenJson.access_token;
}

export async function refundPayPalCapture(
  options: PayPalClientOptions,
  input: {
    captureId: string;
    currencyCode: string;
    /** Major units string (e.g. "10.00"). Omit for full capture refund. */
    amountMajor?: string;
  },
): Promise<void> {
  if (hasNangoProxy(options)) {
    await payPalRestJson(options, `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`, {
      method: "POST",
      body: JSON.stringify(input.amountMajor != null ? {
        amount: {
          value: input.amountMajor,
          currency_code: input.currencyCode.toUpperCase(),
        },
      } : {}),
    });
    return;
  }
  const base = options.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
  const token = await payPalRestToken(options);
  const body =
    input.amountMajor != null
      ? {
          amount: {
            value: input.amountMajor,
            currency_code: input.currencyCode.toUpperCase(),
          },
        }
      : {};
  const res = await fetch(
    `${base}/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`PayPal refund failed: ${res.status} ${text}`);
  }
}

export async function getPayPalOrder(
  options: PayPalClientOptions,
  orderId: string,
): Promise<Order> {
  if (options.accessToken) {
    return await payPalRestJson(options, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: "GET" }) as Order;
  }
  const client = getPayPalClient(options);
  const ordersController = new OrdersController(client);
  const { result } = await ordersController.getOrder({ id: orderId });
  return result;
}

export async function payPalRestJson(options: PayPalClientOptions, path: string, init: RequestInit): Promise<unknown> {
  if (hasNangoProxy(options)) {
    const response = await fetch(`https://api.nango.dev/proxy${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.nangoApiKey}`,
        "Connection-Id": options.nangoConnectionId!,
        "Provider-Config-Key": options.nangoProviderConfigKey!,
        "Base-Url-Override": options.sandbox
          ? "https://api-m.sandbox.paypal.com"
          : "https://api-m.paypal.com",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`PayPal API failed: ${response.status} ${text}`);
    return text ? JSON.parse(text) : {};
  }
  const base = options.sandbox ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
  const token = await payPalRestToken(options);
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`PayPal API failed: ${response.status} ${text}`);
  return text ? JSON.parse(text) : {};
}

function hasNangoProxy(options: PayPalClientOptions): boolean {
  return Boolean(
    options.nangoApiKey?.trim() &&
      options.nangoConnectionId?.trim() &&
      options.nangoProviderConfigKey?.trim(),
  );
}

export async function verifyPayPalWebhookSignature(
  options: PayPalClientOptions,
  headers: Record<string, unknown>,
  rawBody: string,
  webhookId: string,
): Promise<boolean> {
  const base = options.sandbox
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";

  const transmissionId = String(headers["paypal-transmission-id"] ?? "");
  const transmissionTime = String(headers["paypal-transmission-time"] ?? "");
  const transmissionSig = String(headers["paypal-transmission-sig"] ?? "");
  const authAlgo = String(headers["paypal-auth-algo"] ?? "");
  const certUrl = String(headers["paypal-cert-url"] ?? "");

  if (!transmissionId || !transmissionTime || !transmissionSig) {
    return false;
  }

  if (hasNangoProxy(options)) {
    try {
      const result = await payPalRestJson(options, "/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: JSON.stringify({
          auth_algo: authAlgo,
          cert_url: certUrl,
          transmission_id: transmissionId,
          transmission_sig: transmissionSig,
          transmission_time: transmissionTime,
          webhook_id: webhookId,
          webhook_event: JSON.parse(rawBody),
        }),
      }) as { verification_status?: string };
      return result.verification_status === "SUCCESS";
    } catch {
      return false;
    }
  }

  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${options.clientId}:${options.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!tokenRes.ok) return false;
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) return false;

  const verifyRes = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: JSON.parse(rawBody),
    }),
  });
  if (!verifyRes.ok) return false;
  const result = (await verifyRes.json()) as { verification_status?: string };
  return result.verification_status === "SUCCESS";
}
