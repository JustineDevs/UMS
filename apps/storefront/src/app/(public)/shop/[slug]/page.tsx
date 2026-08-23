import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AddToCartSection } from "@/components/AddToCartSection";
import { CatalogProductCard } from "@/components/CatalogProductCard";
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
import { fetchProductBySlug, fetchRelatedProducts } from "@/lib/catalog-fetch";
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
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";
import { ProductVariantProvider } from "@/components/ProductVariantProvider";
import { ProductSelectedPrice } from "@/components/ProductSelectedPrice";

/** Product detail reads stay live so variant availability does not inherit catalog ISR. */
export const dynamic = "force-dynamic";

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

  const [relatedRes, reviews, qaEntries] = await Promise.all([
    fetchRelatedProducts(product, 4),
    fetchProductReviews(slug, { medusaProductId: product.id }),
    fetchProductQaEntries(slug, { medusaProductId: product.id }),
  ]);
  const reviewSummary = summarizeProductReviews(reviews);
  const relatedProducts =
    relatedRes.kind === "ok" ? relatedRes.products : [];

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
          __html: JSON.stringify(productJsonLd),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd),
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
        <div className="grid w-full grid-cols-1 items-start gap-10 lg:gap-14 xl:grid-cols-2 xl:gap-16 2xl:gap-20">
          <div className="min-w-0 space-y-8 xl:max-w-none">
            <ProductGalleryCarousel
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
          <div className="space-y-2 mb-8">
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
            <ShippingDeliveryEstimate />
            <TrustBadgesStrip />
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
            {product.hotspots.map((h, i) => (
              <Link
                key={`${h.productSlug}-${i}`}
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

      {relatedProducts.length > 0 ? (
        <section
          className="mt-16 border-t border-outline-variant/20 pt-16"
          aria-labelledby="related-heading"
        >
          <h2
            id="related-heading"
            className="mb-8 font-headline text-xl font-bold uppercase tracking-wider text-primary"
          >
            You may also like
          </h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {relatedProducts.map((p) => (
              <CatalogProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}

      <ProductQaSection entries={qaEntries} />

      <ProductReviewsSection
        productSlug={slug}
        medusaProductId={product.id}
        reviews={reviews}
      />
      </main>
    </>
  );
}
