import { NextResponse } from "next/server";

import {
  PAYMENT_PROVIDER_IDS,
  type PaymentProviderKey,
} from "@/lib/medusa-checkout";
import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";
import { isMedusaAdminConfigurationError } from "@/lib/medusa-admin-configuration-error";
import { getMedusaRegionId, getMedusaSecretApiKey } from "@/lib/storefront-medusa-env";
import { CHECKOUT_AVAILABILITY } from "@/lib/checkout-availability-codes";
import { resolveStorePaymentProviders } from "@/lib/store-payment-availability";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";

export const dynamic = "force-dynamic";

const PROVIDER_ID_TO_KEY = Object.fromEntries(
  Object.entries(PAYMENT_PROVIDER_IDS).map(([k, v]) => [v, k]),
) as Record<string, PaymentProviderKey>;

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

/**
 * Lists checkout payment keys enabled on the configured Medusa region.
 * Requires `MEDUSA_SECRET_API_KEY` (storefront server) so the Admin API can be called.
 */
export async function GET(req: Request) {
  const rl = await rateLimitFixedWindow(
    // Version the bucket so counters from older local deployments cannot
    // leave a valid checkout page permanently stuck in the loading state.
    `checkout-payment-methods:v2:${getRequestIp(req)}`,
    30,
    60_000,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, keys: [], code: "rate_limited", error: "rate_limited", message: PUBLIC_UNAVAILABLE },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const regionId = getMedusaRegionId()?.trim();
  if (!regionId) {
    const body: AvailabilityJson = {
      ok: false,
      keys: [],
      code: CHECKOUT_AVAILABILITY.MISSING_REGION,
      error: "missing_region",
      message: PUBLIC_UNAVAILABLE,
    };
    return NextResponse.json(body, { status: 200 });
  }

  if (!getMedusaSecretApiKey()) {
    const body: AvailabilityJson = {
      ok: false,
      keys: [],
      code: CHECKOUT_AVAILABILITY.MISSING_CHECKOUT_CONFIG,
      error: "missing_medusa_admin_secret",
      message: PUBLIC_UNAVAILABLE,
    };
    return NextResponse.json(body, { status: 200 });
  }

  try {
    const res = await medusaAdminFetch(
      `/admin/regions/${encodeURIComponent(regionId)}?fields=id,*payment_providers`,
    );
    if (!res.ok) {
      const body: AvailabilityJson = {
        ok: false,
        keys: [],
        code: CHECKOUT_AVAILABILITY.MEDUSA_REGION_FETCH_FAILED,
        error: `admin_${res.status}`,
        message: PUBLIC_UNAVAILABLE,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const j = (await res.json()) as {
      region?: { payment_providers?: Array<{ id?: string } | null> };
    };

    const keys: PaymentProviderKey[] = [];
    for (const p of j.region?.payment_providers ?? []) {
      if (!p?.id) continue;
      const key = PROVIDER_ID_TO_KEY[p.id];
      if (key) keys.push(key);
    }

    const connectedKeys = await resolveStorePaymentProviders(keys);

    if (connectedKeys.length === 0) {
      const body: AvailabilityJson = {
        ok: false,
        keys: [],
        code: CHECKOUT_AVAILABILITY.NO_PAYMENT_PROVIDERS,
        error: "no_payment_providers",
        message: PUBLIC_UNAVAILABLE,
      };
      return NextResponse.json(body, { status: 200 });
    }

    const body: AvailabilityJson = {
      ok: true,
      keys: connectedKeys,
      code: CHECKOUT_AVAILABILITY.OK,
      error: null,
      message: null,
    };
    return NextResponse.json(body);
  } catch (e) {
    if (isMedusaAdminConfigurationError(e)) {
      const body: AvailabilityJson = {
        ok: false,
        keys: [],
        code: CHECKOUT_AVAILABILITY.MISSING_CHECKOUT_CONFIG,
        error: "missing_medusa_admin_secret",
        message: PUBLIC_UNAVAILABLE,
      };
      return NextResponse.json(body, { status: 200 });
    }
    const body: AvailabilityJson = {
      ok: false,
      keys: [],
      code: CHECKOUT_AVAILABILITY.INTERNAL_ERROR,
      error: "fetch_failed",
      message: PUBLIC_UNAVAILABLE,
    };
    return NextResponse.json(body, { status: 200 });
  }
}
