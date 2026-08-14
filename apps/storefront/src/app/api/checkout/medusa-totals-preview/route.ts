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

export const dynamic = "force-dynamic";

/**
 * Server-side Medusa pricing preview (shipping + catalog + tax + loyalty).
 * Uses the same env resolution as other server routes (MEDUSA_BACKEND_URL vs public URL).
 */
export async function POST(req: Request) {
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`medusa-totals-preview:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
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
