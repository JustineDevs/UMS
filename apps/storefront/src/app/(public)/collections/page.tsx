import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { loadCmsCategoryContentListPublic } from "@universal-music-store/platform-data";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { fetchCategorySummaries } from "@/lib/catalog-fetch";
import { buildCatalogCategoryTree } from "@/lib/catalog-category-tree";
import { buildPageMetadata, SEO_KEYWORDS, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildPageMetadata({
  title: "Collections",
  description: `Browse the catalog by category. ${SITE_DESCRIPTION}`,
  path: "/collections",
  keywords: [...SEO_KEYWORDS.collections],
});

export default async function CollectionsPage() {
  const [catRes, cmsRows] = await Promise.all([
    fetchCategorySummaries(),
    loadCmsCategoryContentListPublic(),
  ]);
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
  const featured = buildCatalogCategoryTree(summaries);
  const cmsByCategory = new Map(
    cmsRows.map((row) => [row.collection_id ?? row.collection_handle.toLowerCase(), row]),
  );

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
        {catRes.fetchedAt ? (
          <p className="mt-3 text-xs text-on-surface-variant" data-catalog-freshness>
            Catalog snapshot updated {new Date(catRes.fetchedAt).toLocaleString("en-PH")}. Updates may take up to 60 seconds.
          </p>
        ) : null}
      </header>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((entry) => {
          const label = entry.category;
          const count = entry.count;
          const cms = cmsByCategory.get(entry.id) ?? cmsByCategory.get(entry.handle.toLowerCase());
          return (
            <li key={entry.id}>
              <div className="block rounded-lg border border-outline-variant/20 bg-surface-container-low p-8 transition-colors hover:border-primary/40 hover:bg-surface-container-high">
                {cms?.banner_url ? (
                    <div className="relative mb-5 aspect-[16/9] overflow-hidden rounded-md bg-surface-container-high">
                      <Image
                        src={cms.banner_url}
                        alt={cms.banner_alt ?? `${label} collection image`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        unoptimized={shouldUnoptimizeImage(cms.banner_url)}
                      />
                    </div>
                ) : null}
                <h2 className="font-headline text-2xl font-bold text-primary mb-2">
                  <Link href={`/collections/${encodeURIComponent(entry.handle)}`} className="underline-offset-4 hover:underline">
                    {label}
                  </Link>
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {count > 0
                    ? `${count} active ${count === 1 ? "style" : "styles"}`
                    : "Browse when available"}
                </p>
                <Link
                  href={`/collections/${encodeURIComponent(entry.handle)}`}
                  className="mt-4 inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-widest text-primary underline-offset-4 hover:underline"
                >
                  Open collection →
                </Link>
                {entry.children.length > 0 ? (
                  <div className="mt-5 border-t border-outline-variant/20 pt-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Subcollections</p>
                    <ul className="mt-2 space-y-1">
                      {entry.children.map((child) => (
                        <li key={child.id}>
                          <Link
                            href={`/collections/${encodeURIComponent(child.handle)}`}
                            className="inline-flex min-h-11 items-center text-sm text-primary underline underline-offset-4"
                          >
                            {child.category} ({child.count})
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
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
          className="inline-flex min-h-11 items-center text-primary font-medium underline underline-offset-4"
        >
          View full shop
        </Link>
      </p>
    </main>
  );
}
