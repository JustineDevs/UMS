import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Search",
  description: "Search the shop by product name or keywords.",
  path: "/search",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function SearchPage() {
  return (
    <main className="storefront-page-shell max-w-xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Search the shop
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        Find products by name or keywords.
      </p>
      <form
        action="/shop"
        method="get"
        className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1">
          <label
            htmlFor="catalog-q"
            className="mb-1 block text-xs font-bold uppercase tracking-wider text-primary"
          >
            Keywords
          </label>
          <input
            id="catalog-q"
            name="q"
            type="search"
            maxLength={80}
            placeholder="e.g. electric guitar, bass amp"
            className="w-full rounded border border-outline-variant/30 bg-surface-container-lowest px-4 py-3 text-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded bg-primary px-8 py-3 text-center text-xs font-bold uppercase tracking-widest text-on-primary hover:opacity-90"
        >
          Search
        </button>
      </form>
      <p className="mt-8 text-xs text-on-surface-variant">
        Browse instead:{" "}
        <Link href="/shop" className="text-primary underline">
          All products
        </Link>
        {" · "}
        <Link href="/collections" className="text-primary underline">
          Collections
        </Link>
      </p>
    </main>
  );
}
