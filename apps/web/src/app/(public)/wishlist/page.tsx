import type { Metadata } from "next";
import { WishlistPageClient } from "@/components/WishlistPageClient";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";
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
    <StorefrontPageFrame>
      <StorefrontPageHeader
        title="Saved items"
        description="Keep products you want close."
        aside="Save products, share your list, and add available items to your bag."
      />
      <div className="mt-8">
        <WishlistPageClient />
      </div>
    </StorefrontPageFrame>
  );
}
