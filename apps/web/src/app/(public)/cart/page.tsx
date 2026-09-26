import type { Metadata } from "next";
import Link from "next/link";
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
        <div><h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl">Cart</h1><p className="mt-2 text-sm text-on-surface-variant">Review your items before checkout.</p></div>
        <Link href="/shop" className="text-sm font-semibold text-primary hover:underline">Continue shopping</Link>
      </div>
      <div className="mt-10">
        <CartPageClient />
      </div>
      <CheckoutTrustBadges />
    </main>
  );
}
