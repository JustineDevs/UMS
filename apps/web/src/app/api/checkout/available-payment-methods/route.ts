import { NextResponse } from "next/server";
import { CHECKOUT_AVAILABILITY } from "@/lib/checkout-availability-codes";
import {
  getRequestIp,
  rateLimitFixedWindow,
} from "@/lib/storefront-api-rate-limit";
import { checkoutAvailablePaymentMethodsResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";

export const dynamic = "force-dynamic";

type PaymentProviderKey = "STRIPE" | "PAYPAL" | "XENDIT" | "COD";

const VALID_KEYS = new Set<PaymentProviderKey>([
  "STRIPE",
  "PAYPAL",
  "XENDIT",
  "COD",
]);
const PUBLIC_UNAVAILABLE =
  "Checkout is temporarily unavailable. Please try again later or contact support if this continues.";

type AvailabilityJson =
  | {
      ok: true;
      keys: PaymentProviderKey[];
      code: typeof CHECKOUT_AVAILABILITY.OK;
      error: null;
      message: null;
    }
  | {
      ok: false;
      keys: PaymentProviderKey[];
      code: string;
      error: string;
      message: string;
    };

function unavailable(code: string, error: string, status = 503) {
  const body: AvailabilityJson = {
    ok: false,
    keys: [],
    code,
    error,
    message: PUBLIC_UNAVAILABLE,
  };
  const parsed = checkoutAvailablePaymentMethodsResponseSchema.parse(body);
  return NextResponse.json(parsed, { status });
}

/** Lists payment methods exposed by the Worker capability route. */
export async function GET(req: Request) {
  const rl = await rateLimitFixedWindow(
    `checkout-payment-methods:v3:${getRequestIp(req)}`,
    30,
    60_000,
  );
  if (!rl.ok) return unavailable("rate_limited", "rate_limited", 429);

  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (!apiUrl) {
    return unavailable("WORKER_API_URL_MISSING", "worker_api_url_missing");
  }

  try {
    const response = await fetch(`${apiUrl}/store/payment-methods`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const payload = await readResponseJson(response, {} as {
      ok?: boolean;
      keys?: unknown[];
      code?: string;
    });
    const keys = (payload.keys ?? []).filter(
      (key): key is PaymentProviderKey =>
        typeof key === "string" && VALID_KEYS.has(key as PaymentProviderKey),
    );
    if (response.ok && payload.ok === true && keys.length > 0) {
      const body: AvailabilityJson = {
        ok: true,
        keys,
        code: CHECKOUT_AVAILABILITY.OK,
        error: null,
        message: null,
      };
      const parsed = checkoutAvailablePaymentMethodsResponseSchema.parse(body);
      return NextResponse.json(parsed, {
        headers: { "Cache-Control": "no-store" },
      });
    }
    return unavailable(
      typeof payload.code === "string"
        ? payload.code
        : "WORKER_PAYMENT_METHODS_UNAVAILABLE",
      "worker_payment_methods_unavailable",
    );
  } catch {
    return unavailable(
      "WORKER_PAYMENT_METHODS_UNAVAILABLE",
      "worker_unreachable",
    );
  }
}
