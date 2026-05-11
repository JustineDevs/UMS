const MAYA_SANDBOX_API = "https://pg-sandbox.paymaya.com";
const MAYA_PROD_API = "https://pg.paymaya.com";
const MAYA_SANDBOX_CHECKOUT = "https://payments-web-sandbox.paymaya.com/invoice";
const MAYA_PROD_CHECKOUT = "https://payments.paymaya.com/invoice";

function basicAuth(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export type MayaClientOptions = {
  secretKey: string;
  sandbox: boolean;
};

export type MayaInvoiceInput = {
  sessionId: string;
  amountValue: number;
  currency?: string;
  storefrontUrl: string;
};

export type MayaInvoiceResult = {
  invoiceId: string;
  checkoutUrl: string;
};

export type MayaInvoiceStatus = {
  status: string;
  amountMinor?: number;
  paymentStatus?: string;
  /** P3 transaction reference for void/refund APIs when returned by Maya. */
  transactionReferenceNo?: string;
};

function getApiBase(sandbox: boolean): string {
  return sandbox ? MAYA_SANDBOX_API : MAYA_PROD_API;
}

function getCheckoutBase(sandbox: boolean): string {
  return sandbox ? MAYA_SANDBOX_CHECKOUT : MAYA_PROD_CHECKOUT;
}

export async function createMayaInvoice(
  options: MayaClientOptions,
  input: MayaInvoiceInput,
): Promise<MayaInvoiceResult> {
  const apiBase = getApiBase(options.sandbox);

  const res = await fetch(`${apiBase}/invoice/v2/invoices`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      invoiceNumber: `INV-${input.sessionId.slice(0, 12)}-${Date.now().toString(36)}`,
      type: "SINGLE",
      totalAmount: {
        value: input.amountValue,
        currency: input.currency ?? "PHP",
      },
      redirectUrl: {
        success: `${input.storefrontUrl}/checkout/hosted-return?provider=maya&status=success`,
        failure: `${input.storefrontUrl}/checkout/hosted-return?provider=maya&status=failure`,
        cancel: `${input.storefrontUrl}/checkout/hosted-return?provider=maya&status=cancel`,
      },
      requestReferenceNumber: `medusa_ps:${input.sessionId}`,
      metadata: {},
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Maya create invoice failed: ${res.status} ${text}`);
  }

  const json = JSON.parse(text) as { id?: string };
  const invoiceId = json.id;
  if (!invoiceId) {
    throw new Error("Maya create invoice response missing id.");
  }

  const checkoutBase = getCheckoutBase(options.sandbox);
  const checkoutUrl = `${checkoutBase}?id=${encodeURIComponent(invoiceId)}`;

  return { invoiceId, checkoutUrl };
}

export async function getMayaInvoice(
  options: MayaClientOptions,
  invoiceId: string,
): Promise<MayaInvoiceStatus> {
  const apiBase = getApiBase(options.sandbox);

  const res = await fetch(
    `${apiBase}/invoice/v2/invoices/${encodeURIComponent(invoiceId)}`,
    {
      method: "GET",
      headers: {
        Authorization: basicAuth(options.secretKey),
        Accept: "application/json",
      },
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Maya retrieve invoice failed: ${res.status} ${text}`);
  }

  /** @see https://developers.maya.ph/docs/invoice-api-integration (Get invoice response) */
  const json = JSON.parse(text) as {
    status?: string;
    totalAmount?: { value?: string };
    payments?: Array<
      | string
      | {
          checkoutId?: string;
          id?: string;
          paymentId?: string;
          transactionReferenceNo?: string;
          status?: string;
        }
    >;
    transactionReferenceNo?: string;
  };

  const amountStr = json.totalAmount?.value;
  const amountMinor = amountStr != null
    ? Math.round(parseFloat(String(amountStr)) * 100)
    : undefined;

  const pays = json.payments ?? [];

  let transactionReferenceNo: string | undefined =
    typeof json.transactionReferenceNo === "string" && json.transactionReferenceNo.trim()
      ? json.transactionReferenceNo.trim()
      : undefined;

  for (const p of pays) {
    if (p && typeof p === "object") {
      const po = p as Record<string, unknown>;
      const st = String(po.status ?? "").toUpperCase();
      if (st && st !== "SUCCESS") {
        continue;
      }
      const checkoutId =
        typeof po.checkoutId === "string" && po.checkoutId.trim()
          ? po.checkoutId.trim()
          : undefined;
      if (checkoutId) {
        transactionReferenceNo = checkoutId;
        break;
      }
    }
  }

  if (!transactionReferenceNo) {
    for (const p of pays) {
      if (typeof p === "string" && p.trim()) {
        transactionReferenceNo = p.trim();
        break;
      }
      if (p && typeof p === "object") {
        const po = p as Record<string, unknown>;
        const cand =
          (typeof po.transactionReferenceNo === "string" && po.transactionReferenceNo.trim()
            ? po.transactionReferenceNo.trim()
            : undefined) ??
          (typeof po.id === "string" && po.id.trim() ? po.id.trim() : undefined) ??
          (typeof po.paymentId === "string" && po.paymentId.trim() ? po.paymentId.trim() : undefined);
        if (cand) {
          transactionReferenceNo = cand;
          break;
        }
      }
    }
  }

  let firstPaymentStatus: string | undefined;
  for (const p of pays) {
    if (p && typeof p === "object" && "status" in p) {
      const st = String((p as { status?: string }).status ?? "").toUpperCase();
      if (st === "SUCCESS") {
        firstPaymentStatus = (p as { status?: string }).status;
        break;
      }
    }
  }
  if (firstPaymentStatus == null) {
    for (const p of pays) {
      if (p && typeof p === "object" && "status" in p) {
        firstPaymentStatus = (p as { status?: string }).status;
        break;
      }
    }
  }

  return {
    status: (json.status ?? "").toUpperCase(),
    amountMinor,
    paymentStatus: firstPaymentStatus,
    transactionReferenceNo,
  };
}

function randomRequestRef(): string {
  const base = `medusa${Date.now()}${Math.random().toString(36).slice(2, 15)}`;
  return base.replace(/[^a-zA-Z0-9-]/g, "").slice(0, 36).padEnd(12, "x");
}

/**
 * Maya P3 refund (captured / purchase). Requires the `transactionReferenceNo` from the original payment.
 * @see https://developers.maya.ph/reference/refund
 */
export async function refundMayaP3Payment(
  options: MayaClientOptions,
  input: {
    transactionReferenceNo: string;
    amountValue: number;
    currency: string;
    reason: string;
    merchantRefNo?: string;
  },
): Promise<void> {
  const apiBase = getApiBase(options.sandbox);
  const safeReason = input.reason.replace(/[^-a-zA-Z_0-9 .,]/g, "").slice(0, 512) || "Refund";
  const refNo =
    (input.merchantRefNo?.trim().slice(0, 36) || "medusa-refund").replace(
      /[^-a-zA-Z_0-9]/g,
      "",
    ) || "medusa-refund";
  const res = await fetch(`${apiBase}/p3/refund`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
      "Request-Reference-No": randomRequestRef(),
    },
    body: JSON.stringify({
      transactionReferenceNo: input.transactionReferenceNo,
      merchant: { metadata: { refNo } },
      amount: {
        currency: input.currency.toUpperCase(),
        value: input.amountValue,
      },
      reason: safeReason,
    }),
  });
  const resText = await res.text();
  if (!res.ok) {
    throw new Error(`Maya P3 refund failed: ${res.status} ${resText}`);
  }
}

export async function createMayaVaultToken(
  options: MayaClientOptions,
  cardDetails: {
    number: string;
    expMonth: string;
    expYear: string;
    cvc: string;
  },
): Promise<{ paymentTokenId: string; state: string }> {
  const apiBase = getApiBase(options.sandbox);

  const res = await fetch(`${apiBase}/payments/v1/payment-tokens`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      card: {
        number: cardDetails.number,
        expMonth: cardDetails.expMonth,
        expYear: cardDetails.expYear,
        cvc: cardDetails.cvc,
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Maya vault token failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    paymentTokenId?: string;
    state?: string;
  };
  return {
    paymentTokenId: json.paymentTokenId ?? "",
    state: json.state ?? "",
  };
}

export async function createMayaCheckoutSession(
  options: MayaClientOptions,
  input: {
    totalAmount: { value: number; currency: string };
    items: Array<{ name: string; quantity: number; totalAmount: { value: number } }>;
    requestReferenceNumber: string;
    redirectUrl: { success: string; failure: string; cancel: string };
  },
): Promise<{ checkoutId: string; redirectUrl: string }> {
  const apiBase = getApiBase(options.sandbox);

  const res = await fetch(`${apiBase}/checkout/v1/checkouts`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(options.secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Maya checkout session failed: ${res.status} ${text}`);
  }
  const json = JSON.parse(text) as {
    checkoutId?: string;
    redirectUrl?: string;
  };
  return {
    checkoutId: json.checkoutId ?? "",
    redirectUrl: json.redirectUrl ?? "",
  };
}
