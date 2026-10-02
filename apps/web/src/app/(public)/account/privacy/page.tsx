import type { Metadata } from "next";
import { AccountPrivacyControls } from "@/components/AccountPrivacyControls";
import { AccountRouteFrame } from "@/components/AccountRouteFrame";

export const metadata: Metadata = { title: "Privacy settings", robots: { index: false, follow: false } };

export default function AccountPrivacyPage() {
  return (
    <AccountRouteFrame title="Privacy Settings" description="Control your account data and privacy requests.">
      <AccountPrivacyControls />
    </AccountRouteFrame>
  );
}
