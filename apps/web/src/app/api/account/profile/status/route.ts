import { getStorefrontSession } from "@/lib/auth";
import {
  loadCustomerProfileResult,
  normalizeStorefrontShippingAddress,
} from "@/lib/server-customer-profile";
import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "@/lib/storefront-profile-complete";
import { accountProfileStatusResponseSchema } from "@/lib/admin-api-contracts";
import { readResponseJson } from "@/lib/read-response-json";
import { getStorefrontWorkerAuth } from "@/lib/storefront-worker-auth";

export const dynamic = "force-dynamic";

const privateNoStore = {
  "Cache-Control": "private, no-store, max-age=0",
};

function profileStatusJson(
  payload: unknown,
  init?: Parameters<typeof Response.json>[1],
) {
  return Response.json(accountProfileStatusResponseSchema.parse(payload), init);
}

export async function GET() {
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  // Local E2E uses the deterministic storefront session/profile fixture even
  // when the app is started in production mode. Keep the status gate aligned
  // with the COD payload route instead of asking Supabase for a real session.
  if (process.env.UVS_E2E_LOCAL === "1" && process.env.VERCEL !== "1") {
    const session = await getStorefrontSession();
    const email = session?.user?.email?.trim().toLowerCase();
    if (!email) {
      return profileStatusJson(
        { authenticated: false, complete: false },
        { headers: privateNoStore },
      );
    }
    const { profile, unavailable } = await loadCustomerProfileResult(email);
    if (unavailable) {
      return profileStatusJson(
        {
          authenticated: true,
          available: false,
          error: "Profile status is temporarily unavailable.",
        },
        { status: 503, headers: privateNoStore },
      );
    }
    const complete = isStorefrontProfileComplete(profile);
    return profileStatusJson(
      {
        authenticated: true,
        available: true,
        complete,
        missingFields: complete ? [] : listMissingProfileParts(profile),
        profile,
      },
      { headers: privateNoStore },
    );
  }
  if (workerBaseUrl) {
    try {
      const workerAuth = await getStorefrontWorkerAuth();
      if (!workerAuth) {
        return profileStatusJson(
          { authenticated: false, complete: false },
          { headers: privateNoStore },
        );
      }
      const response = await fetch(`${workerBaseUrl}/store/customers/me`, {
        headers: {
          Authorization: `Bearer ${workerAuth.token}`,
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        return profileStatusJson(
          {
            authenticated: true,
            available: false,
            error: "Profile status is temporarily unavailable.",
          },
          {
            status: response.status >= 500 ? 503 : response.status,
            headers: privateNoStore,
          },
        );
      }
      const payload = await readResponseJson<{
        profile?: Record<string, unknown> | null;
      }>(response, {});
      const raw = payload.profile;
      const profile = raw
        ? {
            displayName:
              typeof raw.display_name === "string" ? raw.display_name : null,
            phone: typeof raw.phone === "string" ? raw.phone : null,
            avatarUrl:
              typeof raw.avatar_url === "string" ? raw.avatar_url : null,
            shippingAddresses: Array.isArray(raw.shipping_addresses)
              ? raw.shipping_addresses.flatMap((item) => {
                  const normalized = normalizeStorefrontShippingAddress(item);
                  return normalized ? [normalized] : [];
                })
              : [],
            updatedAt:
              typeof raw.updated_at === "string" ? raw.updated_at : null,
          }
        : null;
      const complete = isStorefrontProfileComplete(profile);
      return profileStatusJson(
        {
          authenticated: true,
          available: true,
          complete,
          missingFields: complete ? [] : listMissingProfileParts(profile),
          profile,
        },
        { headers: privateNoStore },
      );
    } catch (error) {
      console.error(
        "Worker profile status failed",
        error instanceof Error ? error.message : "unknown",
      );
      return profileStatusJson(
        {
          authenticated: true,
          available: false,
          error: "Profile status is temporarily unavailable.",
        },
        { status: 503, headers: privateNoStore },
      );
    }
  }
  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return profileStatusJson(
      { authenticated: false, complete: false },
      { headers: privateNoStore },
    );
  }
  const { profile, unavailable } = await loadCustomerProfileResult(email);
  if (unavailable) {
    return profileStatusJson(
      {
        authenticated: true,
        available: false,
        error: "Profile status is temporarily unavailable.",
      },
      { status: 503, headers: privateNoStore },
    );
  }
  const complete = isStorefrontProfileComplete(profile);
  return profileStatusJson(
    {
      authenticated: true,
      available: true,
      complete,
      missingFields: complete ? [] : listMissingProfileParts(profile),
      profile: profile
        ? {
            displayName: profile.displayName,
            phone: profile.phone,
            avatarUrl: profile.avatarUrl,
            shippingAddresses: profile.shippingAddresses,
          }
        : null,
    },
    { headers: privateNoStore },
  );
}
