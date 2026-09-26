import type { Metadata } from "next";
import { AccountPrivacyControls } from "@/components/AccountPrivacyControls";
import { AccountRouteFrame } from "@/components/AccountRouteFrame";

export const metadata: Metadata = { title: "Privacy settings", robots: { index: false, follow: false } };

export default function AccountPrivacyPage() {
  return (
    <AccountRouteFrame title="Privacy Settings" description="Control your account data and privacy requests.">
      <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm sm:p-8">
        <h2 className="font-headline text-xl font-bold text-primary">Your data</h2>
        <p className="mt-2 text-sm leading-6 text-on-surface-variant">Download the data associated with your account or request account deletion where legally permitted.</p>
        <AccountPrivacyControls />
      </section>
    </AccountRouteFrame>
  );
}
