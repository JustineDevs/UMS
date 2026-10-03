import type { Metadata } from "next";
import { AccountProfilePanel } from "@/components/AccountProfilePanel";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfileResult } from "@/lib/server-customer-profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Addresses", robots: { index: false, follow: false } };

export default async function AccountAddressesPage() {
  const session = await getStorefrontSession();
  const email = session?.user.email?.trim() ?? "";
  const result = email ? await loadCustomerProfileResult(email) : { profile: null, unavailable: false };
  return (
    <AccountRouteFrame title="Shipping addresses" description="Manage your primary delivery locations.">
      {!session ? <AccountSignInState message="Sign in to save and manage delivery addresses." /> : (
        <AccountProfilePanel
          initial={{
            email,
            displayName: result.profile?.displayName ?? null,
            phone: result.profile?.phone ?? null,
            avatarUrl: result.profile?.avatarUrl ?? null,
            shippingAddresses: result.profile?.shippingAddresses ?? [],
            updatedAt: result.profile?.updatedAt ?? null,
          }}
          mode="addresses"
        />
      )}
    </AccountRouteFrame>
  );
}
