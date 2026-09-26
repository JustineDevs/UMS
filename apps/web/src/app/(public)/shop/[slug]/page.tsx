import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartSection } from "@/components/AddToCartSection";
import { PdpRelatedItems } from "@/components/PdpRelatedItems";
import {
  ProductDetailsAccordions,
  ProductSpecifications,
} from "@/components/ProductDetailsAccordions";
import { ProductAudioHub } from "@/components/ProductAudioHub";
import { ProductTrustPanel } from "@/components/ProductTrustPanel";
import { ProductGalleryCarousel } from "@/components/ProductGalleryCarousel";
import { ProductRatingNearTitle } from "@/components/ProductRatingNearTitle";
import { ProductQaSection } from "@/components/ProductQaSection";
import { ProductReviewsSection } from "@/components/ProductReviewsSection";
import { ShippingDeliveryEstimate } from "@/components/ShippingDeliveryEstimate";
import { TrustBadgesStrip } from "@/components/TrustBadgesStrip";
import { ProductViewTracker } from "@/components/ProductViewTracker";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { ShareProductButton } from "@/components/ShareProductButton";
import { fetchProductBySlug, fetchProductsPage, fetchRelatedProducts } from "@/lib/catalog-fetch";
import { fetchProductQaEntries } from "@/lib/product-qa";
import {
  fetchProductReviews,
  summarizeProductReviews,
} from "@/lib/product-reviews";
import {
  buildJsonLdProduct,
  buildJsonLdBreadcrumb,
  buildPageMetadata,
  canonicalUrl,
  serializeJsonLd,
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { ProductVariantProvider } from "@/components/ProductVariantProvider";
import { ProductSelectedPrice } from "@/components/ProductSelectedPrice";

/** Product detail reads stay live so variant availability does not inherit catalog ISR. */
export const dynamic = "force-dynamic";

/**
 * Optional PDP enrichments must never hold the product route hostage when a
 * secondary service is slow or unavailable. The catalog product itself is
 * authoritative; reviews, Q&A, and related products can safely render empty
 * and recover on a later request.
 */
async function withPdpDeadline<T>(
  operation: Promise<T>,
  fallback: T,
  timeoutMs = 4_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateStaticParams() {
  const { fetchProductSlugsForSitemap } = await import("@/lib/catalog-fetch");
  try {
    const slugs = await fetchProductSlugsForSitemap(500);
    return slugs.map((slug) => ({ slug }));
  } catch {
    return [];
  }
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const res = await fetchProductBySlug(slug);
  if (res.kind !== "ok") {
    return { title: "Product" };
  }
  const { product } = res;
  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const image = product.images[0]?.imageUrl;
  const desc =
    product.seoDescription?.trim() ||
    product.description?.slice(0, 155) ||
    `${product.name} — PHP ${minPrice.toLocaleString("en-PH")}. ${product.category ?? "Music"}. ${SITE_NAME}.`;

  return buildPageMetadata({
    title: product.name,
    description: desc,
    path: `/shop/${slug}`,
    keywords: [
      ...SEO_KEYWORDS.product,
      ...(product.category ? [product.category] : []),
      ...(product.brand ? [product.brand] : []),
    ],
    openGraphType: "website",
    image: image,
    imageAlt: product.name,
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const res = await fetchProductBySlug(slug);

  if (res.kind === "misconfigured" || res.kind === "service_error") {
    return (
      <main className="storefront-page-shell storefront-pdp-shell w-full">
        <div className="mx-auto max-w-2xl pt-8">
          <StorefrontCommerceAlert failure={res} />
        </div>
      </main>
    );
  }

  if (res.kind !== "ok") {
    notFound();
  }

  const { product } = res;

  const [relatedRes, categoryRes, brandRes, reviews, qaEntries] = await Promise.all([
    withPdpDeadline(fetchRelatedProducts(product, 4), { kind: "ok", products: [] }),
    withPdpDeadline(
      product.category?.trim()
        ? fetchProductsPage(6, { category: product.category, sort: "newest" })
        : Promise.resolve({ kind: "ok" as const, products: [], total: 0 }),
      { kind: "ok", products: [], total: 0 },
    ),
    withPdpDeadline(
      product.brand?.trim()
        ? fetchProductsPage(6, { brand: product.brand, sort: "newest" })
        : Promise.resolve({ kind: "ok" as const, products: [], total: 0 }),
      { kind: "ok", products: [], total: 0 },
    ),
    withPdpDeadline(fetchProductReviews(slug, { medusaProductId: product.id }), []),
    withPdpDeadline(fetchProductQaEntries(slug, { medusaProductId: product.id }), []),
  ]);
  const reviewSummary = summarizeProductReviews(reviews);
  const relatedProducts =
    relatedRes.kind === "ok" ? relatedRes.products : [];
  const withoutCurrent = (products: typeof relatedProducts) =>
    products.filter((item) => item.id !== product.id);
  const relatedByCategory = withoutCurrent(
    categoryRes.kind === "ok" && categoryRes.products.length
      ? categoryRes.products
      : relatedProducts,
  );
  const relatedByBrand = withoutCurrent(
    brandRes.kind === "ok" && brandRes.products.length
      ? brandRes.products
      : relatedProducts.filter((item) => item.brand === product.brand),
  );

  const minPrice = Math.min(...product.variants.map((v) => v.price));
  const typeRun = [...new Set(product.variants.map((v) => v.type))]
    .filter(Boolean)
    .sort();
  const compareParams = new URLSearchParams();
  if (product.category?.trim()) compareParams.set("category", product.category.trim());
  if (product.brand?.trim()) compareParams.set("brand", product.brand.trim());
  if (typeRun[0]) compareParams.set("type", typeRun[0]);
  const compareHref = `/shop${compareParams.toString() ? `?${compareParams.toString()}` : ""}`;

  const productJsonLd = buildJsonLdProduct({
    ...product,
    reviewAverage: reviewSummary.average,
    reviewCount: reviewSummary.count,
  });
  const breadcrumbJsonLd = buildJsonLdBreadcrumb([
    { name: "Home", href: "/" },
    { name: "Shop", href: "/shop" },
    { name: product.name, href: `/shop/${slug}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(productJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(breadcrumbJsonLd),
        }}
      />
      <main className="storefront-page-shell storefront-pdp-shell w-full">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-on-surface-variant">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span aria-hidden="true" className="select-none">/</span>
          <Link href="/shop" className="hover:text-primary">Shop</Link>
          {product.category && (
            <>
              <span aria-hidden="true" className="select-none">/</span>
              <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="hover:text-primary">
                {product.category}
              </Link>
            </>
          )}
          <span aria-hidden="true" className="select-none">/</span>
          <span className="text-primary font-medium" aria-current="page">{product.name}</span>
        </nav>
        <ProductViewTracker slug={slug} id={product.id} />
        <ProductVariantProvider product={product}>
        <div className="grid w-full grid-cols-1 items-start gap-10 lg:gap-14 xl:grid-cols-[minmax(0,1.1fr)_minmax(26rem,0.9fr)] xl:gap-16 2xl:gap-20">
          <div className="min-w-0 space-y-8 xl:max-w-none">
            <ProductGalleryCarousel
              key={product.id}
              slides={product.gallerySlides}
              productName={product.name}
            />
            <div className="hidden border-t border-outline-variant/20 pt-8 xl:block">
              <ProductDetailsAccordions
                product={product}
                typeRun={typeRun}
              />
            </div>
          </div>

        <div className="min-w-0 flex flex-col justify-start">
          <div className="space-y-2 mb-8 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6">
            {product.category && (
              <span className="text-xs font-label uppercase tracking-widest text-secondary">
                {product.category}
              </span>
            )}
            {product.brand ? (
              <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant">
                {product.brand}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-primary">
                {product.brand || "Universal Music Store"}
              </span>
              {(() => {
                const compareAt = product.variants
                  .map((variant) => variant.compareAtPrice)
                  .filter((value): value is number => typeof value === "number" && value > minPrice)
                  .sort((a, b) => a - b)[0];
                return compareAt ? (
                  <span className="rounded bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-secondary">
                    Save PHP {(compareAt - minPrice).toLocaleString("en-PH")}
                  </span>
                ) : null;
              })()}
            </div>
            <h1 className="text-4xl md:text-5xl font-headline font-bold tracking-tighter text-primary">
              {product.name}
            </h1>
            <ProductRatingNearTitle
              average={reviewSummary.average}
              count={reviewSummary.count}
            />
            <ProductSelectedPrice fallback={minPrice} />
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              <Link
                href={compareHref}
                className="rounded-full border border-outline-variant/30 px-3 py-1.5 font-medium text-primary hover:bg-primary hover:text-on-primary"
              >
                Compare similar
              </Link>
              <Link
                href="#reviews"
                className="rounded-full border border-outline-variant/30 px-3 py-1.5 font-medium text-on-surface-variant hover:text-primary"
              >
                Read reviews
              </Link>
            </div>
          </div>

          <div className="space-y-10">
            <AddToCartSection product={product} />
            <div className="flex items-center gap-3">
              <Link
                href="/variant-guide"
                className="text-xs font-medium text-on-surface-variant underline underline-offset-2 hover:text-primary"
              >
                Variant guide
              </Link>
              <span className="text-outline-variant" aria-hidden="true">·</span>
              <ShareProductButton
                title={product.name}
                description={product.description ?? undefined}
                url={canonicalUrl(`/shop/${product.slug}`)}
              />
            </div>
            <div className="space-y-4">
              <ShippingDeliveryEstimate />
              <TrustBadgesStrip />
            </div>
            <div className="border-t border-outline-variant/20 pt-8">
              <ProductSpecifications product={product} />
              <ProductAudioHub product={product} />
              <ProductTrustPanel product={product} />
            </div>
            <div className="border-t border-outline-variant/20 pt-8 xl:hidden">
              <ProductDetailsAccordions
                product={product}
                typeRun={typeRun}
              />
            </div>
          </div>
        </div>
      </div>
      </ProductVariantProvider>

      {product.lifestyleImageUrl?.trim() ? (
        <section
          className="mt-16 border-t border-outline-variant/20 pt-16"
          aria-labelledby="lifestyle-heading"
        >
          <h2
            id="lifestyle-heading"
            className="mb-6 font-headline text-lg font-bold uppercase tracking-wider text-primary"
          >
            Shop the look
          </h2>
          <div className="relative aspect-[4/3] w-full max-w-4xl overflow-hidden rounded-lg bg-surface-container-low">
            <Image
              src={product.lifestyleImageUrl!.trim()}
              alt={`${product.name} lifestyle`}
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 896px"
              unoptimized={shouldUnoptimizeImage(product.lifestyleImageUrl)}
            />
            {product.hotspots.map((h) => (
              <Link
                key={`${h.productSlug}-${h.xPct}-${h.yPct}`}
                href={`/shop/${h.productSlug}`}
                className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-on-primary bg-primary text-[10px] font-bold uppercase text-on-primary shadow-md hover:bg-on-primary hover:text-primary"
                style={{ left: `${h.xPct}%`, top: `${h.yPct}%` }}
                title={h.label ?? "View product"}
              >
                +
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-16" id="product-information" aria-label="Product information">
        <nav className="sticky top-0 z-10 flex gap-8 border-b border-outline-variant/20 bg-surface/95 py-4 backdrop-blur" aria-label="Product information tabs">
          <a href="#description" className="border-b-2 border-primary pb-3 text-sm font-semibold text-primary">Description</a>
          <a href="#reviews" className="pb-3 text-sm font-semibold text-on-surface-variant hover:text-primary">Reviews</a>
        </nav>
        <div id="description" className="mt-8 rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-6 md:p-8">
          <h2 className="font-headline text-2xl font-bold text-primary">{product.name}</h2>
          {product.description ? (
            <div className="mt-5 whitespace-pre-line text-sm leading-7 text-on-surface-variant">{product.description}</div>
          ) : (
            <p className="mt-5 text-sm text-on-surface-variant">Product description coming soon.</p>
          )}
        </div>
      </section>

      {relatedByCategory.length || relatedByBrand.length ? (
        <div className="mt-16">
          <PdpRelatedItems byCategory={relatedByCategory} byBrand={relatedByBrand} />
        </div>
      ) : null}

      <ProductQaSection entries={qaEntries} />

      <ProductReviewsSection
        key={`${product.id}:${slug}`}
        productSlug={slug}
        medusaProductId={product.id}
        reviews={reviews}
      />
      </main>
    </>
  );
}
