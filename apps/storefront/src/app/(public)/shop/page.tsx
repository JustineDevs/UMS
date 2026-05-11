import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { loadCmsCategoryContentPublic } from "@apparel-commerce/platform-data";
import {
  sanitizeCmsHtml,
  SHOP_PRODUCT_PAGE_SIZE,
} from "@apparel-commerce/validation";
import { CatalogProductCard } from "@/components/CatalogProductCard";
import { CmsBlocksRenderer } from "@/components/CmsBlocksRenderer";
import {
  fetchProductsPage,
  fetchCategorySummaries,
  fetchVariantFacets,
} from "@/lib/catalog-fetch";
import {
  primaryCommerceFailure,
  secondaryCommerceFailure,
} from "@/lib/catalog-fetch-helpers";
import { cssColorForVariantColorLabel } from "@/lib/variant-color-swatch";
import type { ShopQuery } from "@/lib/shop-url";
import { shopHref } from "@/lib/shop-url";
import { parseShopPageQuery } from "@/lib/shop-page-query";
import { CatalogSearchTypeahead } from "@/components/CatalogSearchTypeahead";
import { ShopPriceRangeForm } from "@/components/ShopPriceRangeForm";
import { ShopSortSelect } from "@/components/ShopSortSelect";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { canonicalUrl, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const revalidate = 60;

type ShopSearchParams = {
  category?: string;
  locale?: string;
  size?: string;
  color?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  offset?: string;
  q?: string;
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = parseShopPageQuery(sp);
  const searchQ = q.q?.trim() || undefined;
  const offset = q.offset ?? 0;
  const normalizedBase: ShopQuery = {
    category: q.category,
    size: q.size,
    color: q.color,
    brand: q.brand,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    search: searchQ,
    sort: q.sort,
  };
  const canonical = canonicalUrl(shopHref(normalizedBase));
  const prevOffset = offset - SHOP_PRODUCT_PAGE_SIZE;
  const nextOffset = offset + SHOP_PRODUCT_PAGE_SIZE;
  const alternates: Record<string, unknown> = { canonical };
  const toShopQuery = (patch: { offset: number }) => ({
    ...normalizedBase,
    offset: patch.offset,
  });
  if (prevOffset >= 0) {
    alternates.prev = canonicalUrl(shopHref(toShopQuery({ offset: prevOffset })));
  }
  alternates.next = canonicalUrl(shopHref(toShopQuery({ offset: nextOffset })));
  return {
    title: "Shop — All Products",
    description: SITE_DESCRIPTION,
    alternates: alternates as Metadata["alternates"],
    openGraph: {
      title: `Shop | ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
      url: canonical,
    },
  };
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const sp = await searchParams;
  const cmsLocale = (sp.locale ?? "en").trim() || "en";
  const q = parseShopPageQuery(sp);

  const category = q.category?.trim() || undefined;
  const size = q.size?.trim() || undefined;
  const color = q.color?.trim() || undefined;
  const brand = q.brand?.trim() || undefined;
  const minPrice = q.minPrice;
  const maxPrice = q.maxPrice;
  const searchQ = q.q?.trim() || undefined;
  const sort = q.sort ?? "newest";
  const offset = q.offset ?? 0;
  const limit = q.limit ?? SHOP_PRODUCT_PAGE_SIZE;

  const [pageRes, catRes, facetRes, cmsCategory] = await Promise.all([
    fetchProductsPage(limit, {
      category,
      size,
      color,
      brand,
      minPrice,
      maxPrice,
      q: searchQ,
      sort,
      offset,
      revalidate: 60,
    }),
    fetchCategorySummaries(),
    fetchVariantFacets(category),
    category ? loadCmsCategoryContentPublic(category, cmsLocale) : Promise.resolve(null),
  ]);

  const blockingFailure = primaryCommerceFailure(pageRes);
  if (blockingFailure) {
    return (
      <main className="storefront-page-shell max-w-[1600px] pb-12 sm:pb-16 md:pb-24">
        <div className="mx-auto max-w-2xl pt-8">
          <StorefrontCommerceAlert failure={blockingFailure} />
        </div>
      </main>
    );
  }

  const okPage = pageRes as Extract<typeof pageRes, { kind: "ok" }>;
  const { products, total } = okPage;
  const categories =
    catRes.kind === "ok"
      ? catRes.summaries
      : ([] as Extract<typeof catRes, { kind: "ok" }>["summaries"]);
  const facets =
    facetRes.kind === "ok"
      ? facetRes.facets
      : { sizes: [] as string[], colors: [] as string[], brands: [] as string[] };

  const sidebarWarning = secondaryCommerceFailure(catRes, facetRes);

  const totalActive = categories.reduce((s, c) => s + c.count, 0);
  const allProductsCountLabel =
    categories.length > 0 ? totalActive : total;
  const hasMore = offset + products.length < total;

  const base = (): ShopQuery => ({
    category,
    size,
    color,
    brand,
    minPrice,
    maxPrice,
    sort,
    search: searchQ,
  });

  const h = (patch: Partial<ShopQuery>) => shopHref({ ...base(), ...patch });

  return (
    <main className="storefront-page-shell max-w-[1600px] pb-12 sm:pb-16 md:pb-24">
      {sidebarWarning ? (
        <div className="mx-auto mb-8 max-w-3xl px-4 sm:px-6 lg:px-8">
          <StorefrontCommerceAlert failure={sidebarWarning} />
        </div>
      ) : null}
      {cmsCategory?.banner_url ? (
        <div className="relative mb-10 aspect-[21/9] w-full overflow-hidden rounded-2xl bg-surface-container-low">
          <Image
            src={cmsCategory.banner_url}
            alt=""
            fill
            sizes="(max-width: 1600px) 100vw, 1600px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}
      <header className="mb-12 grid grid-cols-1 items-end gap-8 sm:mb-16 lg:mb-20 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <h1 className="font-headline text-[clamp(2rem,6.5vw,4.5rem)] font-bold leading-[1.05] tracking-tighter text-primary">
            Shop
            <br />
            <span className="text-[clamp(1.2rem,4vw,2.75rem)] font-bold">
              All products
            </span>
          </h1>
          {searchQ ? (
            <p className="mt-4 font-body text-base text-on-surface-variant">
              Search results for{" "}
              <strong className="text-primary">{searchQ}</strong>
            </p>
          ) : null}
          {cmsCategory?.intro_html?.trim() ? (
            <div
              className="mt-4 max-w-xl font-body text-base leading-relaxed text-on-surface-variant md:text-lg"
              dangerouslySetInnerHTML={{
                __html: sanitizeCmsHtml(String(cmsCategory.intro_html)),
              }}
            />
          ) : (
            <p className="mt-4 max-w-xl font-body text-base leading-relaxed text-on-surface-variant md:text-lg">
              Browse the catalog with filters for category, size, color, and price.
              Product details, stock, and checkout use the live store system.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-6 justify-start lg:col-span-4 lg:items-end lg:justify-end">
          <CatalogSearchTypeahead
            initialQ={searchQ}
            category={category}
            size={size}
            color={color}
            brand={brand}
            minPrice={minPrice}
            maxPrice={maxPrice}
            sort={sort}
          />
          <ShopSortSelect
            value={sort}
            category={category}
            size={size}
            color={color}
            brand={brand}
            minPrice={minPrice}
            maxPrice={maxPrice}
            search={searchQ}
          />
        </div>
      </header>

      {cmsCategory?.blocks?.length ? (
        <div className="mb-10">
          <CmsBlocksRenderer blocks={cmsCategory.blocks} />
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-10 lg:flex-row lg:gap-12">
        <aside className="w-full lg:w-64 flex-shrink-0 space-y-12">
          <section>
            <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em] mb-6 text-primary">
              Category
            </h3>
            <ul className="space-y-4">
              <li>
                <Link
                  href={h({ category: undefined, size, color })}
                  className={`flex items-center justify-between text-sm transition-colors ${
                    !category
                      ? "font-medium text-primary"
                      : "text-on-surface-variant hover:text-primary"
                  }`}
                >
                  <span>All</span>
                  <span className="text-[10px] text-on-surface-variant">
                    ({allProductsCountLabel})
                  </span>
                </Link>
              </li>
              {categories.map((c) => (
                <li key={c.category}>
                  <Link
                    href={h({
                      category: c.category,
                      size: undefined,
                      color: undefined,
                    })}
                    className={`flex items-center justify-between text-sm transition-colors ${
                      category === c.category
                        ? "font-medium text-primary"
                        : "text-on-surface-variant hover:text-primary"
                    }`}
                  >
                    <span>{c.category}</span>
                    <span className="text-[10px]">({c.count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em] mb-6 text-primary">
              Size
            </h3>
            {facets.sizes.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No sizes in this view.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {facets.sizes.map((s) => {
                  const active = size === s;
                  return (
                    <Link
                      key={s}
                      href={h({
                        size: active ? undefined : s,
                        color,
                      })}
                      className={`aspect-square flex items-center justify-center text-[10px] font-bold transition-all rounded ${
                        active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low hover:bg-primary hover:text-on-primary"
                      }`}
                    >
                      {s}
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em] mb-6 text-primary">
              Color
            </h3>
            {facets.colors.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No colors in this view.
              </p>
            ) : (
              <div className="space-y-3">
                {facets.colors.map((col) => {
                  const active = color === col;
                  return (
                    <Link
                      key={col}
                      href={h({
                        size,
                        color: active ? undefined : col,
                      })}
                      className={`flex items-center gap-3 w-full group rounded px-1 py-0.5 -mx-1 ${
                        active ? "ring-1 ring-primary" : ""
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-outline-variant shrink-0"
                        style={{ backgroundColor: cssColorForVariantColorLabel(col) }}
                      />
                      <span className="text-xs font-medium text-on-surface-variant group-hover:text-primary transition-colors uppercase tracking-wider">
                        {col}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em] mb-6 text-primary">
              Brand
            </h3>
            {facets.brands.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Set brand on products in store metadata to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.brands.map((b) => {
                  const active = brand === b;
                  return (
                    <li key={b}>
                      <Link
                        href={h({
                          brand: active ? undefined : b,
                        })}
                        className={`text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {b}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="font-headline text-sm font-bold uppercase tracking-[0.2em] mb-6 text-primary">
              Price (PHP)
            </h3>
            <ShopPriceRangeForm
              category={category}
              size={size}
              color={color}
              brand={brand}
              sort={sort}
              search={searchQ}
              minPrice={minPrice}
              maxPrice={maxPrice}
            />
          </section>

          {(category ||
            size ||
            color ||
            searchQ ||
            brand ||
            minPrice != null ||
            maxPrice != null) && (
            <Link
              href="/shop"
              className="inline-block text-xs font-medium text-primary underline underline-offset-4 hover:opacity-80"
            >
              Clear filters
            </Link>
          )}
        </aside>

        <div className="flex-grow">
          {products.length === 0 ? (
            <div className="rounded-lg border border-surface-container-high bg-surface-container-lowest p-12 text-center">
              <p className="text-on-surface-variant">
                No products match these filters.
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-block text-primary text-sm font-medium underline"
              >
                View all products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-16 xl:grid-cols-3">
              {products.map((product) => (
                <CatalogProductCard
                  key={product.id}
                  product={product}
                  intervalMs={3000}
                />
              ))}
            </div>
          )}

          {total > 0 && (
            <div className="mt-16 flex flex-col items-center gap-6">
              <p className="font-body text-xs text-on-surface-variant uppercase tracking-widest">
                Showing {offset + 1}–{Math.min(offset + products.length, total)}{" "}
                of {total}
              </p>
              {hasMore && (
                <Link
                  href={h({
                    offset: offset + limit,
                  })}
                  className="px-12 py-4 border border-primary text-primary text-xs font-bold uppercase tracking-[0.2em] hover:bg-primary hover:text-on-primary transition-all"
                >
                  Load more
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
