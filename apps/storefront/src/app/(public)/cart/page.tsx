import type { Metadata } from "next";
import { CartPageClient } from "./cart-client";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import Link from "next/link";

export const metadata: Metadata = buildPageMetadata({
  title: "Cart",
  description: "Review items before checkout.",
  path: "/cart",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function CartPage() {
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Your bag
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">
        Review items before checkout. Prices update again at checkout with
        shipping and taxes.
      </p>
      <div className="mt-10">
        <CartPageClient />
      </div>
      <aside className="mt-10 rounded-xl border border-outline-variant/20 bg-surface-container-low/50 p-5" aria-label="Checkout assurances">
        <div className="grid gap-4 text-sm text-on-surface-variant sm:grid-cols-3">
          <div className="min-w-0">
            <p className="font-semibold text-primary">Secure checkout</p>
            <p className="mt-1 text-xs leading-relaxed">Payment details are handled by the selected payment provider.</p>
          </div>
          <div>
            <p className="font-semibold text-primary">Easy returns</p>
            <Link href="/returns" className="mt-1 inline-flex min-h-11 items-center text-xs underline underline-offset-2">Review our return policy</Link>
          </div>
          <div>
            <p className="font-semibold text-primary">Need help?</p>
            <Link href="/contact" className="mt-1 inline-flex min-h-11 items-center text-xs underline underline-offset-2">Contact customer support</Link>
          </div>
        </div>
      </aside>
    </main>
  );
}
