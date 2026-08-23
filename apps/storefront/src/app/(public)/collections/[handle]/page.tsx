import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCmsCategoryContentPublic } from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { fetchCategorySummaries, fetchProductsPage } from "@/lib/catalog-fetch";
import { buildPageMetadata, canonicalUrl, SITE_DESCRIPTION } from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ locale?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const canonicalHandle = decodeURIComponent(handle).trim();
  const categories = await fetchCategorySummaries();
  const label = categories.kind === "ok"
    ? categories.summaries.find((category) => category.handle.toLowerCase() === canonicalHandle.toLowerCase())?.category ?? canonicalHandle
    : canonicalHandle;
  return buildPageMetadata({
    title: `${label} collection`,
    description: `Browse the ${label} collection. ${SITE_DESCRIPTION}`,
    path: `/collections/${encodeURIComponent(canonicalHandle)}`,
  });
}

export default async function CollectionByHandlePage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { locale = "en", page: pageRaw } = await searchParams;
  const h = decodeURIComponent(handle).trim();
  if (!h) notFound();
  const parsedPage = Number.parseInt(pageRaw ?? "1", 10);
  const currentPage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = 24;

  const [categories, page] = await Promise.all([
    fetchCategorySummaries(),
    fetchProductsPage(pageSize, {
      category: h,
      sort: "newest",
      offset: (currentPage - 1) * pageSize,
      revalidate: 60,
    }),
  ]);
  const category = categories.kind === "ok"
    ? categories.summaries.find((c) => c.handle.toLowerCase() === h.toLowerCase())
    : null;
  if (categories.kind === "ok" && !category) notFound();
  const categoryLabel = category?.category ?? h;
  const cms = await loadCmsCategoryContentPublic(h, locale.trim() || "en", category?.id);
  if (page.kind !== "ok") return <main className="storefront-page-shell"><StorefrontCommerceAlert failure={page} /></main>;

  const collectionUrl = canonicalUrl(`/collections/${encodeURIComponent(h)}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Collections", item: canonicalUrl("/collections") },
          { "@type": "ListItem", position: 2, name: categoryLabel, item: collectionUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `${categoryLabel} products`,
        numberOfItems: page.total,
        itemListElement: page.products.map((product, index) => ({
          "@type": "ListItem",
          position: (currentPage - 1) * pageSize + index + 1,
          url: canonicalUrl(`/shop/${encodeURIComponent(product.slug)}`),
          name: product.name,
        })),
      },
    ],
  };

  return (
    <main className="storefront-page-shell max-w-[1600px] pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {cms?.banner_url ? <div className="relative mb-10 aspect-[21/9] overflow-hidden rounded-2xl bg-surface-container-low"><Image src={cms.banner_url} alt={cms.banner_alt ?? `${categoryLabel} collection banner`} fill priority className="object-cover" sizes="100vw" unoptimized={shouldUnoptimizeImage(cms.banner_url)} /></div> : null}
      <header className="mb-10 max-w-3xl">
        <nav aria-label="Breadcrumb" className="mb-5 text-sm text-on-surface-variant">
          <Link href="/collections" className="underline underline-offset-4">All collections</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{categoryLabel}</span>
        </nav>
        <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-6xl">{categoryLabel}</h1>
        {cms?.intro_html?.trim() ? <div className="mt-4 leading-relaxed text-on-surface-variant" dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(String(cms.intro_html)) }} /> : <p className="mt-4 text-on-surface-variant">Browse instruments and gear in the {categoryLabel} collection.</p>}
        <p className="mt-4 text-sm text-on-surface-variant" aria-live="polite">
          {page.total === 0 ? "No products currently available" : `Showing ${page.total} ${page.total === 1 ? "product" : "products"}`}
        </p>
        <p className="mt-1 text-sm text-on-surface-variant">Sorted by newest</p>
      </header>
      {page.products.length ? <ul aria-label={`${categoryLabel} products`} className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{page.products.map((product) => <li key={product.id}><CatalogProductCard product={product} /></li>)}</ul> : <p className="text-on-surface-variant">{currentPage > 1 ? "That collection page is no longer available." : "No products are currently available in this collection."}</p>}
      {page.total > pageSize ? (
        <nav aria-label="Collection pages" className="mt-12 flex items-center justify-between gap-4 border-t border-outline-variant/20 pt-6">
          {currentPage > 1 ? <Link href={`/collections/${encodeURIComponent(h)}?page=${currentPage - 1}`} className="min-h-11 rounded border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:border-primary">Previous</Link> : <span />}
          <span className="text-sm text-on-surface-variant">Page {currentPage} of {Math.ceil(page.total / pageSize)}</span>
          {currentPage < Math.ceil(page.total / pageSize) ? <Link href={`/collections/${encodeURIComponent(h)}?page=${currentPage + 1}`} className="min-h-11 rounded border border-outline-variant/40 px-4 py-2 text-sm font-semibold hover:border-primary">Next</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
