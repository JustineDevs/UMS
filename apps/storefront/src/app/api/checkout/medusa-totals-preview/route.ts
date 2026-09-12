import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "@/lib/storefront-profile-complete";
import { profileToCodCartAddresses } from "@/lib/medusa-profile-address";
import { logCommerceObservabilityServer } from "@/lib/commerce-observability";
import {
  handleMedusaTotalsPreviewRequest,
} from "@/lib/medusa-totals-preview-route-handler";
import { executeMedusaCheckoutTotalsPreview } from "@/lib/medusa-checkout-cart-prep";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";

export const dynamic = "force-dynamic";

/**
 * Server-side Worker pricing preview for every checkout method.
 * The Worker is the only commerce authority; legacy Medusa pricing is not a
 * fallback when the Worker API is configured.
 */
export async function POST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`medusa-totals-preview:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const apiUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (apiUrl) {
    try {
      const response = await fetch(`${apiUrl}/store/checkout/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: await req.clone().text(),
        cache: "no-store",
      });
      const payload = await response.text();
      return new Response(payload, { status: response.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "Checkout preview is temporarily unavailable." }, { status: 503 });
    }
  }

  return handleMedusaTotalsPreviewRequest(req, {
    getSessionEmail: async () => {
      const session = await getStorefrontSession();
      return session?.user?.email?.trim().toLowerCase() ?? null;
    },
    loadCustomerProfile,
    isProfileComplete: isStorefrontProfileComplete,
    listMissingProfileParts,
    profileToCodCartAddresses,
    executePreview: executeMedusaCheckoutTotalsPreview,
    logEvent: (event, payload) => {
      logCommerceObservabilityServer(
        event as Parameters<typeof logCommerceObservabilityServer>[0],
        payload,
      );
    },
  });
}
