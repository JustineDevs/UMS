import type { Metadata } from "next";
import { CartPageClient } from "./cart-client";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { CheckoutTrustBadges } from "@/components/CheckoutTrustBadges";

export const metadata: Metadata = buildPageMetadata({
  title: "Cart",
  description: "Review items before checkout.",
  path: "/cart",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function CartPage() {
  return (
    <main className="storefront-page-shell max-w-6xl">
      <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/25 pb-8 sm:flex-row sm:items-end">
        <div><p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-on-surface-variant">// SHOPPING CART</p><h1 className="mt-3 font-headline text-4xl font-bold tracking-tight text-primary sm:text-6xl">Your cart</h1></div>
        <p className="max-w-sm text-sm leading-6 text-on-surface-variant">Review your items, adjust quantities, and continue securely to checkout.</p>
      </div>
      <div className="mt-10">
        <CartPageClient />
      </div>
      <CheckoutTrustBadges />
    </main>
  );
}
