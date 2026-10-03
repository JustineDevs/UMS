import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import {
  StorefrontActionButton,
  StorefrontField,
  StorefrontPageFrame,
  StorefrontPageHeader,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Search",
  description: "Search the shop by product name or keywords.",
  path: "/search",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function SearchPage() {
  return (
    <StorefrontPageFrame width="narrow">
      <StorefrontPageHeader
        title="Search the shop"
        description="Find products by name or keywords."
      />
      <form
        action="/shop"
        method="get"
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <StorefrontField
          label="Keywords"
          id="catalog-q"
          name="q"
          type="search"
          maxLength={80}
          placeholder="e.g. electric guitar, bass amp"
          autoComplete="off"
          enterKeyHint="search"
        />
        <StorefrontActionButton type="submit" variant="primary">
          Search
        </StorefrontActionButton>
      </form>
      <p className="mt-6 text-sm text-on-surface-variant">
        Browse instead:{" "}
        <Link href="/shop" className="text-primary underline">
          All products
        </Link>
      </p>
    </StorefrontPageFrame>
  );
}
