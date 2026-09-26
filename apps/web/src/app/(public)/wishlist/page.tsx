import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/WishlistPageClient";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Saved items",
  description: "Items saved in this browser session.",
  path: "/wishlist",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function WishlistPage() {
  return (
    <main className="storefront-page-shell max-w-5xl">
      <div className="flex flex-col justify-between gap-4 border-b border-outline-variant/25 pb-8 sm:flex-row sm:items-end">
        <div><h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl">Saved items</h1><p className="mt-2 text-sm text-on-surface-variant">Keep products you want close.</p></div>
        <p className="max-w-sm text-sm leading-6 text-on-surface-variant">{`Save products, share your list, and add available items to your bag.`}</p>
      </div>
      <div className="mt-10">
        <WishlistPageClient />
      </div>
    </main>
  );
}
