import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfile } from "@/lib/server-customer-profile";
import {
  isStorefrontProfileComplete,
  listMissingProfileParts,
} from "@/lib/storefront-profile-complete";

export const dynamic = "force-dynamic";

const privateNoStore = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET() {
  const session = await getStorefrontSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) {
    return Response.json({ authenticated: false, complete: false }, { headers: privateNoStore });
  }
  const profile = await loadCustomerProfile(email);
  const complete = isStorefrontProfileComplete(profile);
  return Response.json({
    authenticated: true,
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
