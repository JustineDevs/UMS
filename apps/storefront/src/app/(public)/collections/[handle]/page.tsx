import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCmsCategoryContentPublic } from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { fetchCategorySummaries, fetchProductsPage } from "@/lib/catalog-fetch";
import { buildPageMetadata, SITE_DESCRIPTION } from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ handle: string }>;
  searchParams: Promise<{ locale?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const label = decodeURIComponent(handle).trim();
  return buildPageMetadata({
    title: `${label} collection`,
    description: `Browse the ${label} collection. ${SITE_DESCRIPTION}`,
    path: `/collections/${encodeURIComponent(label)}`,
  });
}

export default async function CollectionByHandlePage({ params, searchParams }: Props) {
  const { handle } = await params;
  const { locale = "en" } = await searchParams;
  const h = decodeURIComponent(handle).trim();
  if (!h) notFound();

  const [categories, page, cms] = await Promise.all([
    fetchCategorySummaries(),
    fetchProductsPage(24, { category: h, sort: "newest", revalidate: 60 }),
    loadCmsCategoryContentPublic(h, locale.trim() || "en"),
  ]);
  if (categories.kind === "ok" && !categories.summaries.some((c) => c.category.toLowerCase() === h.toLowerCase())) notFound();
  if (page.kind !== "ok") return <main className="storefront-page-shell"><StorefrontCommerceAlert failure={page} /></main>;

  return (
    <main className="storefront-page-shell max-w-[1600px] pb-16">
      {cms?.banner_url ? <div className="relative mb-10 aspect-[21/9] overflow-hidden rounded-2xl bg-surface-container-low"><Image src={cms.banner_url} alt="" fill priority className="object-cover" sizes="100vw" unoptimized={shouldUnoptimizeImage(cms.banner_url)} /></div> : null}
      <header className="mb-10 max-w-3xl">
        <Link href="/collections" className="mb-5 inline-block text-sm text-on-surface-variant underline underline-offset-4">All collections</Link>
        <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-6xl">{h}</h1>
        {cms?.intro_html?.trim() ? <div className="mt-4 leading-relaxed text-on-surface-variant" dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(String(cms.intro_html)) }} /> : <p className="mt-4 text-on-surface-variant">Browse instruments and gear in the {h} collection.</p>}
      </header>
      {page.products.length ? <ul className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">{page.products.map((product) => <li key={product.id}><CatalogProductCard product={product} /></li>)}</ul> : <p className="text-on-surface-variant">No products are currently available in this collection.</p>}
    </main>
  );
}
