import type { Metadata } from "next";
import Link from "next/link";
import { getStorefrontSession } from "@/lib/auth";
import { AccountLoyaltyPanel } from "@/components/AccountLoyaltyPanel";
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
    return <main className="storefront-page-shell max-w-2xl"><h1 className="font-headline text-4xl font-extrabold text-primary">Loyalty wallet</h1><p className="mt-3 text-sm text-on-surface-variant">Sign in to view your points and activity.</p><Link href="/sign-in?callbackUrl=/account/loyalty" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary">Sign in</Link></main>;
  }

  return <main className="storefront-page-shell max-w-3xl"><div className="mb-8"><Link href="/account" className="text-sm font-semibold text-primary hover:underline">← Account</Link><p className="mt-8 text-xs font-bold uppercase tracking-[0.18em] text-primary">Rewards</p><h1 className="mt-2 font-headline text-4xl font-extrabold tracking-tight text-primary">Loyalty wallet</h1><p className="mt-3 text-sm leading-6 text-on-surface-variant">Use eligible points at checkout and review the durable activity recorded for your account.</p></div><section className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 sm:p-7"><AccountLoyaltyPanel /></section></main>;
}
