import type { Metadata } from "next";
import { AccountProfilePanel } from "@/components/AccountProfilePanel";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";
import { loadCustomerProfileResult } from "@/lib/server-customer-profile";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile", robots: { index: false, follow: false } };

export default async function AccountProfilePage() {
  const session = await getStorefrontSession();
  const email = session?.user.email?.trim() ?? "";
  const result = email ? await loadCustomerProfileResult(email) : { profile: null, unavailable: false };
  return (
    <AccountRouteFrame title="Account settings" description="Manage your profile details and account preferences.">
      {!session ? <AccountSignInState /> : (
        <AccountProfilePanel
          initial={{
            email,
            displayName: result.profile?.displayName ?? session.user.name ?? null,
            phone: result.profile?.phone ?? null,
            avatarUrl: result.profile?.avatarUrl ?? session.user.image ?? null,
            shippingAddresses: result.profile?.shippingAddresses ?? [],
            updatedAt: result.profile?.updatedAt ?? null,
          }}
          mode="profile"
        />
      )}
    </AccountRouteFrame>
  );
}
