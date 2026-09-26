import type { Metadata } from "next";
import { getStorefrontSession } from "@/lib/auth";
import { AccountLoyaltyPanel } from "@/components/AccountLoyaltyPanel";
import { AccountRouteFrame, AccountSignInState } from "@/components/AccountRouteFrame";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = buildPageMetadata({
  title: "Loyalty wallet",
  description: "View your available points and loyalty activity.",
  path: "/account/loyalty",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
  referrer: "no-referrer",
});

export default async function LoyaltyPage() {
  const session = await getStorefrontSession();
  if (!session?.user) {
    return <AccountRouteFrame title="My Coins" description="Review your available points and recent loyalty activity."><AccountSignInState message="Sign in to view your points and activity." /></AccountRouteFrame>;
  }

  return <AccountRouteFrame title="My Coins" description="Review your available points and recent loyalty activity."><section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"><AccountLoyaltyPanel /></section></AccountRouteFrame>;
}
