import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "@/lib/storefront-profile-complete";
import { profileToCodCartAddresses } from "@/lib/checkout-address";
import { getRequestIp, rateLimitFixedWindow } from "@/lib/storefront-api-rate-limit";
import { isSameOriginMutation } from "@/lib/request-origin";
import { checkoutCodCartPayloadResponseSchema } from "@/lib/admin-api-contracts";

export const dynamic = "force-dynamic";

/**
 * Server-validated delivery identity for COD. Client must not invent addresses.
 */
async function handlePOST(req: Request) {
  if (!isSameOriginMutation(req)) {
    return Response.json({ error: "Cross-site mutation rejected" }, { status: 403 });
  }
  const ip = getRequestIp(req);
  const rl = await rateLimitFixedWindow(`cod-cart-payload:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return Response.json(
      { error: "Too many requests", retryAfter: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ error: "Sign in to use cash on delivery." }, { status: 401 });
  }

  const profile = await loadCustomerProfile(email);
  if (!profile || !isStorefrontProfileComplete(profile)) {
    return Response.json(
      {
        error: "Complete your delivery profile before choosing cash on delivery.",
        missingFields: listMissingProfileParts(profile),
      },
      { status: 400 },
    );
  }

  const payload = profileToCodCartAddresses(profile, email);
  if (!payload) {
    return Response.json(
      {
        error: "Add a delivery address in your account before using cash on delivery.",
        missingFields: ["Delivery address"],
      },
      { status: 400 },
    );
  }

  // This endpoint only returns server-owned profile data for the already
  // authenticated customer; it does not mutate a cart or create an order.
  // Keep the fixed-window rate limit above, but do not apply BotID here: its
  // browser challenge can reject legitimate hosted checkout sessions before
  // the actual, separately authorized COD order mutation runs.
  return Response.json(checkoutCodCartPayloadResponseSchema.parse(payload));
}

export const POST = handlePOST;
