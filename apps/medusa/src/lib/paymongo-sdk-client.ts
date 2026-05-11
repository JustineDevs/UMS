const PAYMONGO_API = "https://api.paymongo.com/v1";

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export type PaymongoClientOptions = {
  secretKey: string;
};

export type PaymongoCheckoutSessionInput = {
  amountMinor: number;
  currency: string;
  description: string;
  referenceNumber: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethodTypes?: string[];
};

export type PaymongoCheckoutSessionResult = {
  checkoutSessionId: string;
  checkoutUrl: string;
};

export type PaymongoCheckoutSessionStatus = {
  status: string;
  amountMinor?: number;
  paymentId?: string;
  paymentIntentId?: string;
  paymentIntentStatus?: string;
};

export type PaymongoLinkInput = {
  amountMinor: number;
  currency: string;
  description: string;
};

export type PaymongoLinkResult = {
  linkId: string;
  checkoutUrl: string;
};

export type PaymongoLinkStatus = {
  status: string;
  amountMinor?: number;
  /** Present after PayMongo records a payment for this link. */
  paymentId?: string;
};

export type PaymongoPaymentIntentInput = {
  amountMinor: number;
  currency: string;
  description: string;
  paymentMethodTypes?: string[];
};

export type PaymongoPaymentIntentResult = {
  intentId: string;
  clientKey: string;
  status: string;
};

export async function createPaymongoCheckoutSession(
  options: PaymongoClientOptions,
  input: PaymongoCheckoutSessionInput,
): Promise<PaymongoCheckoutSessionResult> {
  const res = await fetch(`${PAYMONGO_API}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          billing_information_fields_editable: "enabled",
          cancel_url: input.cancelUrl,
          success_url: input.successUrl,
          description: input.description,
          reference_number: input.referenceNumber,
          currency: input.currency.toUpperCase(),
          payment_method_types: input.paymentMethodTypes ?? ["gcash"],
          send_email_receipt: false,
          show_description: false,
          show_line_items: false,
          line_items: [
            {
              amount: Math.round(input.amountMinor),
              currency: input.currency.toUpperCase(),
              description: input.description,
              name: "Order total",
              quantity: 1,
            },
          ],
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `PayMongo create checkout session failed: ${res.status} ${text}`,
    );
  }
  const json = JSON.parse(text) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
  };
  const checkoutSessionId = json.data?.id;
  const checkoutUrl = json.data?.attributes?.checkout_url;
  if (!checkoutSessionId || !checkoutUrl) {
    throw new Error(
      "PayMongo response missing checkout session id or checkout_url.",
    );
  }
  return { checkoutSessionId, checkoutUrl };
}

export async function getPaymongoCheckoutSession(
  options: PaymongoClientOptions,
  checkoutSessionId: string,
): Promise<PaymongoCheckoutSessionStatus> {
  const res = await fetch(
    `${PAYMONGO_API}/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`,
    {
      method: "GET",
      headers: { Authorization: basicAuth(options.secretKey) },
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `PayMongo retrieve checkout session failed: ${res.status} ${text}`,
    );
  }
  const json = JSON.parse(text) as {
    data?: {
      attributes?: {
        status?: string;
        payment_intent?: {
          id?: string;
          attributes?: {
            amount?: number;
            status?: string;
            payments?: Array<{ id?: string }>;
          };
        };
      };
    };
  };
  const attrs = json.data?.attributes;
  const paymentIntent = attrs?.payment_intent;
  const payments = paymentIntent?.attributes?.payments ?? [];
  const paymentId =
    payments[0] && typeof payments[0] === "object" && payments[0]?.id?.trim()
      ? payments[0].id.trim()
      : undefined;
  return {
    status: (attrs?.status ?? "").toLowerCase(),
    amountMinor: paymentIntent?.attributes?.amount,
    paymentId,
    paymentIntentId: paymentIntent?.id,
    paymentIntentStatus: paymentIntent?.attributes?.status?.toLowerCase(),
  };
}

export async function createPaymongoLink(
  options: PaymongoClientOptions,
  input: PaymongoLinkInput,
): Promise<PaymongoLinkResult> {
  const res = await fetch(`${PAYMONGO_API}/links`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(input.amountMinor),
          currency: input.currency,
          description: input.description,
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayMongo create link failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    data?: { id?: string; attributes?: { checkout_url?: string } };
  };
  const linkId = json.data?.id;
  const checkoutUrl = json.data?.attributes?.checkout_url;
  if (!linkId || !checkoutUrl) {
    throw new Error("PayMongo response missing link id or checkout_url.");
  }
  return { linkId, checkoutUrl };
}

export async function getPaymongoLink(
  options: PaymongoClientOptions,
  linkId: string,
): Promise<PaymongoLinkStatus> {
  const res = await fetch(
    `${PAYMONGO_API}/links/${encodeURIComponent(linkId)}`,
    {
      method: "GET",
      headers: { Authorization: basicAuth(options.secretKey) },
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayMongo retrieve link failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    data?: {
      attributes?: {
        status?: string;
        amount?: number;
        payments?: string[] | Array<{ id?: string }>;
      };
    };
  };
  const attrs = json.data?.attributes;
  let paymentId: string | undefined;
  const pays = attrs?.payments;
  if (Array.isArray(pays) && pays.length > 0) {
    const p0 = pays[0];
    if (typeof p0 === "string" && p0.trim()) {
      paymentId = p0.trim();
    } else if (p0 && typeof p0 === "object" && typeof p0.id === "string" && p0.id.trim()) {
      paymentId = p0.id.trim();
    }
  }
  return {
    status: (attrs?.status ?? "").toLowerCase(),
    amountMinor: attrs?.amount,
    paymentId,
  };
}

export async function createPaymongoPaymentIntent(
  options: PaymongoClientOptions,
  input: PaymongoPaymentIntentInput,
): Promise<PaymongoPaymentIntentResult> {
  const res = await fetch(`${PAYMONGO_API}/payment_intents`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(input.amountMinor),
          currency: input.currency,
          description: input.description,
          payment_method_allowed: input.paymentMethodTypes ?? [
            "card",
            "gcash",
            "grab_pay",
            "paymaya",
          ],
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayMongo create payment intent failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    data?: {
      id?: string;
      attributes?: { client_key?: string; status?: string };
    };
  };
  return {
    intentId: json.data?.id ?? "",
    clientKey: json.data?.attributes?.client_key ?? "",
    status: json.data?.attributes?.status ?? "",
  };
}

export async function createPaymongoRefund(
  options: PaymongoClientOptions,
  paymentId: string,
  amountMinor: number,
  reason: string,
): Promise<{ refundId: string; status: string }> {
  const res = await fetch(`${PAYMONGO_API}/refunds`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount: Math.round(amountMinor),
          payment_id: paymentId,
          reason,
        },
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`PayMongo refund failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    data?: { id?: string; attributes?: { status?: string } };
  };
  return {
    refundId: json.data?.id ?? "",
    status: json.data?.attributes?.status ?? "",
  };
}

export async function listPaymongoWebhooks(
  options: PaymongoClientOptions,
): Promise<Array<{ id: string; url: string; events: string[] }>> {
  const res = await fetch(`${PAYMONGO_API}/webhooks`, {
    method: "GET",
    headers: { Authorization: basicAuth(options.secretKey) },
  });
  if (!res.ok) {
    throw new Error(`PayMongo list webhooks failed: ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      attributes?: { url?: string; events?: string[] };
    }>;
  };
  return (json.data ?? []).map((w) => ({
    id: w.id ?? "",
    url: w.attributes?.url ?? "",
    events: w.attributes?.events ?? [],
  }));
}
