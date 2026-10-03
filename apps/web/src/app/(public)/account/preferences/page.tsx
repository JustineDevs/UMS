import type { Metadata } from "next";
import { AccountOrderPreferencesPanel } from "@/components/AccountOrderPreferencesPanel";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Order settings", robots: { index: false, follow: false } };

export default async function AccountPreferencesPage() {
  const session = await getStorefrontSession();
  return (
    <AccountRouteFrame title="Order Settings" description="Choose how we should handle unavailable items before fulfillment.">
      {!session ? <AccountSignInState message="Sign in to manage order preferences." /> : (
        <AccountOrderPreferencesPanel />
      )}
    </AccountRouteFrame>
  );
}
