import type { Metadata } from "next";
import { AccountMarketingPreferencesPanel } from "@/components/AccountMarketingPreferencesPanel";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { getStorefrontSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Notification settings", robots: { index: false, follow: false } };

export default async function AccountNotificationsPage() {
  const session = await getStorefrontSession();
  return (
    <AccountRouteFrame title="Notification Settings" description="Choose the updates you want to receive from the store.">
      {!session ? <AccountSignInState message="Sign in to manage your notification preferences." /> : (
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
          <AccountMarketingPreferencesPanel headingId="account-route-notifications-heading" />
        </section>
      )}
    </AccountRouteFrame>
  );
}
