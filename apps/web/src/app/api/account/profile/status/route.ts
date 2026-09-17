import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfileResult } from "@/lib/server-customer-profile";
import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "@/lib/storefront-profile-complete";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const privateNoStore = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const workerBaseUrl = process.env.API_URL?.trim().replace(/\/$/, "");
  if (workerBaseUrl) {
    try {
      const supabase = await createSupabaseServerClient();
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);
      const token = sessionData.session?.access_token?.trim();
      const email = userData.user?.email?.trim().toLowerCase();
      if (!email || !token) {
        return Response.json({ authenticated: false, complete: false }, { headers: privateNoStore });
      }
      const response = await fetch(`${workerBaseUrl}/store/customers/me`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) {
        return Response.json(
          { authenticated: true, available: false, error: "Profile status is temporarily unavailable." },
          { status: response.status >= 500 ? 503 : response.status, headers: privateNoStore },
        );
      }
      const payload = (await response.json()) as { profile?: Record<string, unknown> | null };
      const raw = payload.profile;
      const profile = raw
        ? {
            displayName: typeof raw.display_name === "string" ? raw.display_name : null,
            phone: typeof raw.phone === "string" ? raw.phone : null,
            avatarUrl: typeof raw.avatar_url === "string" ? raw.avatar_url : null,
            shippingAddresses: Array.isArray(raw.shipping_addresses) ? raw.shipping_addresses : [],
            updatedAt: typeof raw.updated_at === "string" ? raw.updated_at : null,
          }
        : null;
      const complete = isStorefrontProfileComplete(profile);
      return Response.json(
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
      console.error("Worker profile status failed", error instanceof Error ? error.message : "unknown");
      return Response.json(
        { authenticated: true, available: false, error: "Profile status is temporarily unavailable." },
        { status: 503, headers: privateNoStore },
      );
    }
  }
  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ authenticated: false, complete: false }, { headers: privateNoStore });
  }
  const { profile, unavailable } = await loadCustomerProfileResult(email);
  if (unavailable) {
    return Response.json(
      { authenticated: true, available: false, error: "Profile status is temporarily unavailable." },
      { status: 503, headers: privateNoStore },
    );
  }
  const complete = isStorefrontProfileComplete(profile);
  return Response.json({
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
  }, { headers: privateNoStore });
}
