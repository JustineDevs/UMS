import Link from "next/link";
import type { Metadata } from "next";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { fetchCategorySummaries } from "@/lib/catalog-fetch";
import { buildPageMetadata, SEO_KEYWORDS, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Collections",
  description: `Browse the catalog by category. ${SITE_DESCRIPTION}`,
  path: "/collections",
  keywords: [...SEO_KEYWORDS.collections],
});

export default async function CollectionsPage() {
  const catRes = await fetchCategorySummaries();
  if (catRes.kind !== "ok") {
    return (
      <main className="storefront-page-shell max-w-[1200px]">
        <div className="mx-auto max-w-2xl pt-8">
          <StorefrontCommerceAlert failure={catRes} />
        </div>
      </main>
    );
  }
  const summaries = catRes.summaries;
  // Render the complete catalog summary. The shop remains the source of truth;
  // silently truncating categories made published collections undiscoverable.
  const featured = summaries;

  return (
    <main className="storefront-page-shell max-w-[1200px]">
      <header className="mb-10 sm:mb-12 md:mb-16">
        <p className="mb-3 font-label text-xs uppercase tracking-[0.25em] text-secondary sm:mb-4">
          {SITE_NAME}
        </p>
        <h1 className="mb-4 font-headline text-4xl font-bold tracking-tighter text-primary sm:mb-6 sm:text-5xl md:text-6xl">
          Collections
        </h1>
        <p className="font-body text-on-surface-variant max-w-2xl leading-relaxed">
          Open the shop with a live category filter applied. Product counts update from the catalog,
          so this page stays aligned with whatever your store actually carries.
        </p>
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((entry) => {
          const label = entry.category;
          const count = entry.count;
          return (
            <li key={label}>
              <Link
                href={`/collections/${encodeURIComponent(label)}`}
                className="block rounded-lg border border-outline-variant/20 bg-surface-container-low p-8 transition-colors hover:border-primary/40 hover:bg-surface-container-high"
              >
                <h2 className="font-headline text-2xl font-bold text-primary mb-2">
                  {label}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {count > 0
                    ? `${count} active ${count === 1 ? "style" : "styles"}`
                    : "Browse when available"}
                </p>
                <span className="mt-4 inline-block text-xs font-bold uppercase tracking-widest text-primary">
                  Open in shop →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {featured.length === 0 ? (
        <p className="mt-8 text-center text-sm text-on-surface-variant">
          No categories have been published yet. Add products in the catalog first.
        </p>
      ) : null}
      <p className="mt-12 text-center">
        <Link
          href="/shop"
          className="text-primary font-medium underline underline-offset-4"
        >
          View full shop
        </Link>
      </p>
    </main>
  );
}
