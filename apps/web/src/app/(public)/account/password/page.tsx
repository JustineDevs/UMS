import type { Metadata } from "next";
import { AccountRouteFrame, AccountUnavailableState } from "@/components/AccountRouteFrame";

export const metadata: Metadata = { title: "Change password", robots: { index: false, follow: false } };

export default function AccountPasswordPage() {
  return (
    <AccountRouteFrame title="Change Password" description="Keep your sign-in method secure.">
      <AccountUnavailableState
        title="Password changes are managed by sign-in"
        message="Storefront accounts use secure Google sign-in. There is no local password stored in this app, so password changes are handled by your identity provider."
        actionHref="/login?callbackUrl=%2Faccount%2Fprofile&reauth=1"
        actionLabel="Re-authenticate"
      />
    </AccountRouteFrame>
  );
}
