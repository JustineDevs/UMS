import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { loadCmsCategoryContentPublic } from "@universal-music-store/platform-data";
import {
  sanitizeCmsHtml,
  SHOP_PRODUCT_PAGE_SIZE,
} from "@universal-music-store/validation";
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
import {
  parseShopPageQuery,
  parseShopPageQueryDiagnostics,
  shopPageShouldNoIndex,
} from "@/lib/shop-page-query";
import { CatalogSearchTypeahead } from "@/components/CatalogSearchTypeahead";
import { ShopPriceRangeForm } from "@/components/ShopPriceRangeForm";
import { ShopSortSelect } from "@/components/ShopSortSelect";
import { ShopFilterDrawer } from "@/components/ShopFilterDrawer";
import { ShopFilterGroup } from "@/components/ShopFilterGroup";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import {
  buildPageMetadata,
  SEO_KEYWORDS,
  SITE_DESCRIPTION,
} from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const revalidate = 60;

type ShopSearchParams = {
  category?: string;
  locale?: string;
  type?: string;
  finish?: string;
  brand?: string;
  pickupConfig?: string;
  bodyWood?: string;
  condition?: string;
  skillLevel?: string;
  shippingSpeed?: string;
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
  const category = q.category?.trim() || undefined;
  const type = q.type?.trim() || undefined;
  const finish = q.finish?.trim() || undefined;
  const brand = q.brand?.trim() || undefined;
  const searchQ = q.q?.trim() || undefined;
  const normalizedBase: ShopQuery = {
    category,
    type,
    finish,
    brand,
    pickupConfig: q.pickupConfig,
    bodyWood: q.bodyWood,
    condition: q.condition,
    skillLevel: q.skillLevel,
    shippingSpeed: q.shippingSpeed,
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    search: searchQ,
    sort: q.sort,
  };
  const pageTitle = searchQ
    ? `Shop results for ${searchQ}`
    : category
      ? `${category} at the shop`
      : "Shop instruments and gear";
  const pageDescription = searchQ
    ? `Search the catalog for ${searchQ}. ${SITE_DESCRIPTION}`
    : category
      ? `Browse ${category.toLowerCase()} products in the live catalog. ${SITE_DESCRIPTION}`
      : SITE_DESCRIPTION;
  return buildPageMetadata({
    title: pageTitle,
    description: pageDescription,
    path: shopHref(normalizedBase),
    keywords: [
      ...SEO_KEYWORDS.shop,
      ...(category ? [category] : []),
      ...(type ? [type] : []),
      ...(finish ? [finish] : []),
      ...(brand ? [brand] : []),
      ...(searchQ ? [searchQ] : []),
    ],
    noindex: shopPageShouldNoIndex(q),
  });
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<ShopSearchParams>;
}) {
  const sp = await searchParams;
  const cmsLocale = (sp.locale ?? "en").trim() || "en";
  const diagnostics = parseShopPageQueryDiagnostics(sp);
  if (diagnostics.invalidKeys.length > 0) {
    const allowedQueryKeys = new Set([
      "category",
      "type",
      "finish",
      "brand",
      "pickupConfig",
      "bodyWood",
      "condition",
      "skillLevel",
      "shippingSpeed",
      "minPrice",
      "maxPrice",
      "sort",
      "offset",
      "q",
    ]);
    const canonical = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (
        key === "locale" ||
        !allowedQueryKeys.has(key) ||
        diagnostics.invalidKeys.includes(key)
      ) continue;
      if (typeof value === "string" && value.trim()) canonical.set(key, value);
    }
    redirect(canonical.toString() ? `/shop?${canonical}` : "/shop");
  }
  const q = diagnostics.query;

  const category = q.category?.trim() || undefined;
  const type = q.type?.trim() || undefined;
  const finish = q.finish?.trim() || undefined;
  const brand = q.brand?.trim() || undefined;
  const pickupConfig = q.pickupConfig?.trim() || undefined;
  const bodyWood = q.bodyWood?.trim() || undefined;
  const condition = q.condition?.trim() || undefined;
  const skillLevel = q.skillLevel?.trim() || undefined;
  const shippingSpeed = q.shippingSpeed?.trim() || undefined;
  const minPrice = q.minPrice;
  const maxPrice = q.maxPrice;
  const searchQ = q.q?.trim() || undefined;
  const sort = q.sort ?? "newest";
  const offset = q.offset ?? 0;
  const limit = q.limit ?? SHOP_PRODUCT_PAGE_SIZE;

  const [pageRes, catRes, facetRes] = await Promise.all([
    fetchProductsPage(limit, {
      category,
      type,
      finish,
      brand,
      pickupConfig,
      bodyWood,
      condition,
      skillLevel,
      shippingSpeed,
      minPrice,
      maxPrice,
      q: searchQ,
      sort,
      offset,
      revalidate: 60,
    }),
    fetchCategorySummaries(),
    fetchVariantFacets(category),
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
  const cmsCategory = category
    ? await loadCmsCategoryContentPublic(
        category,
        cmsLocale,
        categories.find((item) => item.handle === category)?.id,
      )
    : null;
  const facets =
    facetRes.kind === "ok"
      ? facetRes.facets
      : {
          types: [] as string[],
          finishes: [] as string[],
          brands: [] as string[],
          pickupConfigs: [] as string[],
          bodyWoods: [] as string[],
          conditions: [] as string[],
          skillLevels: [] as string[],
          shippingSpeeds: [] as string[],
        };

  const sidebarWarning = secondaryCommerceFailure(catRes, facetRes);

  const totalActive = categories.reduce((s, c) => s + c.count, 0);
  const allProductsCountLabel =
    categories.length > 0 ? totalActive : total;
  const hasMore = offset + products.length < total;

  const base = (): ShopQuery => ({
    category,
    type,
    finish,
    brand,
    pickupConfig,
    bodyWood,
    condition,
    skillLevel,
    shippingSpeed,
    minPrice,
    maxPrice,
    sort,
    search: searchQ,
  });

  const h = (patch: Partial<ShopQuery>) => shopHref({ ...base(), ...patch });
  const activeFilterCount = [
    category,
    type,
    finish,
    brand,
    pickupConfig,
    bodyWood,
    condition,
    skillLevel,
    shippingSpeed,
    searchQ,
    minPrice,
    maxPrice,
  ].filter((value) => value !== undefined && value !== "").length;

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
            alt={cmsCategory.banner_alt ?? `${category ?? "Shop"} collection banner`}
            fill
            sizes="(max-width: 1600px) 100vw, 1600px"
            className="object-cover"
            priority
            unoptimized={shouldUnoptimizeImage(cmsCategory.banner_url)}
          />
        </div>
      ) : null}
      <header className="mb-12 grid grid-cols-1 items-end gap-8 sm:mb-16 lg:mb-20 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <h1 className="font-headline text-[clamp(2rem,6.5vw,4.5rem)] font-bold leading-[1.05] tracking-tighter text-primary">
            Shop
            <br />
            <span className="text-[clamp(1.2rem,4vw,2.75rem)] font-bold">
              All instruments
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
              Browse the catalog with filters for category, instrument type,
              finish, pickup layout, body wood, condition, skill level,
              shipping speed, and price. Product details, stock, and checkout
              use the live store system.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-6 justify-start lg:col-span-4 lg:items-end lg:justify-end">
          <CatalogSearchTypeahead
            initialQ={searchQ}
            category={category}
            type={type}
            finish={finish}
            brand={brand}
            pickupConfig={pickupConfig}
            bodyWood={bodyWood}
            condition={condition}
            skillLevel={skillLevel}
            shippingSpeed={shippingSpeed}
            minPrice={minPrice}
            maxPrice={maxPrice}
            sort={sort}
          />
          <ShopSortSelect
            value={sort}
            category={category}
            type={type}
            finish={finish}
            brand={brand}
            pickupConfig={pickupConfig}
            bodyWood={bodyWood}
            condition={condition}
            skillLevel={skillLevel}
            shippingSpeed={shippingSpeed}
            minPrice={minPrice}
            maxPrice={maxPrice}
            search={searchQ}
          />
        </div>
      </header>

      {cmsCategory?.blocks?.length ? (
        <div className="mb-10">
          {await CmsBlocksRenderer({ blocks: cmsCategory.blocks })}
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col gap-10 lg:flex-row lg:gap-12">
        <ShopFilterDrawer activeFilterCount={activeFilterCount}>
          <aside className="w-full space-y-12">
          <ShopFilterGroup title="Category">
            <ul className="space-y-4">
              <li>
                <Link
                  href={h({
                    category: undefined,
                    type,
                    finish,
                    pickupConfig,
                    bodyWood,
                    condition,
                    skillLevel,
                    shippingSpeed,
                  })}
                  aria-current={!category ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-between text-sm transition-colors ${
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
                      type: undefined,
                      finish: undefined,
                      pickupConfig: undefined,
                      bodyWood: undefined,
                      condition: undefined,
                      skillLevel: undefined,
                      shippingSpeed: undefined,
                    })}
                    aria-current={category === c.category ? "page" : undefined}
                    className={`flex min-h-11 items-center justify-between text-sm transition-colors ${
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
          </ShopFilterGroup>

          <ShopFilterGroup title="Type">
            {facets.types.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No types in this view.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {facets.types.map((t) => {
                  const active = type === t;
                  return (
                  <Link
                    key={t}
                      href={h({
                        type: active ? undefined : t,
                        finish,
                        pickupConfig,
                        bodyWood,
                        condition,
                        skillLevel,
                        shippingSpeed,
                      })}
                      aria-current={active ? "page" : undefined}
                      className={`aspect-square flex items-center justify-center text-[10px] font-bold transition-all rounded ${
                        active
                          ? "bg-primary text-on-primary"
                          : "bg-surface-container-low hover:bg-primary hover:text-on-primary"
                      }`}
                    >
                      {t}
                    </Link>
                  );
                })}
              </div>
            )}
          </ShopFilterGroup>

          <ShopFilterGroup title="Finish">
            {facets.finishes.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                No finishes in this view.
              </p>
            ) : (
              <div className="space-y-3">
                {facets.finishes.map((col) => {
                  const active = finish === col;
                  return (
                    <Link
                      key={col}
                      href={h({
                        type,
                        finish: active ? undefined : col,
                        pickupConfig,
                        bodyWood,
                        condition,
                        skillLevel,
                        shippingSpeed,
                        })}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 w-full group rounded px-1 py-0.5 -mx-1 ${
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
          </ShopFilterGroup>

          <ShopFilterGroup title="Brand">
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
                          pickupConfig,
                          bodyWood,
                          condition,
                          skillLevel,
                          shippingSpeed,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center text-sm ${
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
          </ShopFilterGroup>

          <ShopFilterGroup title="Price (PHP)">
            <ShopPriceRangeForm
              category={category}
              type={type}
              finish={finish}
              brand={brand}
              pickupConfig={pickupConfig}
              bodyWood={bodyWood}
              condition={condition}
              skillLevel={skillLevel}
              shippingSpeed={shippingSpeed}
              sort={sort}
              search={searchQ}
              minPrice={minPrice}
              maxPrice={maxPrice}
            />
          </ShopFilterGroup>

          <ShopFilterGroup title="Pickup config">
            {facets.pickupConfigs.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Add pickup config metadata to variants to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.pickupConfigs.map((value) => {
                  const active = pickupConfig === value;
                  return (
                    <li key={value}>
                      <Link
                        href={h({
                          pickupConfig: active ? undefined : value,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {value}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ShopFilterGroup>

          <ShopFilterGroup title="Body wood">
            {facets.bodyWoods.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Add body wood metadata to variants to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.bodyWoods.map((value) => {
                  const active = bodyWood === value;
                  return (
                    <li key={value}>
                      <Link
                        href={h({
                          bodyWood: active ? undefined : value,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {value}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ShopFilterGroup>

          <ShopFilterGroup title="Condition">
            {facets.conditions.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Add condition metadata to variants to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.conditions.map((value) => {
                  const active = condition === value;
                  return (
                    <li key={value}>
                      <Link
                        href={h({
                          condition: active ? undefined : value,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {value}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ShopFilterGroup>

          <ShopFilterGroup title="Skill level">
            {facets.skillLevels.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Add skill level metadata to variants to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.skillLevels.map((value) => {
                  const active = skillLevel === value;
                  return (
                    <li key={value}>
                      <Link
                        href={h({
                          skillLevel: active ? undefined : value,
                        })}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {value}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ShopFilterGroup>

          <ShopFilterGroup title="Shipping speed">
            {facets.shippingSpeeds.length === 0 ? (
              <p className="text-xs text-on-surface-variant">
                Add shipping speed metadata to variants to filter here.
              </p>
            ) : (
              <ul className="space-y-2">
                {facets.shippingSpeeds.map((value) => {
                  const active = shippingSpeed === value;
                  return (
                    <li key={value}>
                      <Link
                        href={h({
                          shippingSpeed: active ? undefined : value,
                        })}
                        className={`flex min-h-11 items-center text-sm ${
                          active
                            ? "font-medium text-primary"
                            : "text-on-surface-variant hover:text-primary"
                        }`}
                      >
                        {value}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </ShopFilterGroup>

          {(category ||
            type ||
            finish ||
            pickupConfig ||
            bodyWood ||
            condition ||
            skillLevel ||
            shippingSpeed ||
            searchQ ||
            brand ||
            minPrice != null ||
            maxPrice != null) && (
            <Link
              href="/shop"
              className="inline-flex min-h-11 items-center text-xs font-medium text-primary underline underline-offset-4 hover:opacity-80"
            >
              Clear filters
            </Link>
          )}
          </aside>
        </ShopFilterDrawer>

        <div className="flex-grow">
          {products.length === 0 ? (
            <div className="rounded-lg border border-surface-container-high bg-surface-container-lowest p-12 text-center">
              <p className="text-on-surface-variant" role="status" aria-live="polite">
                {searchQ
                  ? `No products found for “${searchQ}”. Try a broader term or browse the full catalog.`
                  : "No products match these filters."}
              </p>
              <Link
                href={searchQ ? h({ search: undefined, offset: 0 }) : "/shop"}
                className="mt-4 inline-flex min-h-11 items-center text-primary text-sm font-medium underline"
              >
                {searchQ ? "Clear search" : "View all products"}
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
              <p className="font-body text-xs text-on-surface-variant uppercase tracking-widest" role="status" aria-live="polite">
                Showing {offset + 1}–{Math.min(offset + products.length, total)}{" "}
                of {total}
              </p>
              <nav
                aria-label="Shop pages"
                className="flex flex-wrap items-center justify-center gap-3"
              >
                {offset > 0 ? (
                  <Link
                    href={h({ offset: Math.max(0, offset - limit) })}
                    rel="prev"
                    aria-label="Previous shop page"
                    className="inline-flex min-h-11 items-center border border-outline-variant/50 px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:border-primary"
                  >
                    Previous page
                  </Link>
                ) : null}
                {hasMore ? (
                  <Link
                    href={h({ offset: offset + limit })}
                    rel="next"
                    aria-label="Next shop page"
                    className="inline-flex min-h-11 items-center border border-primary px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-primary transition-all hover:bg-primary hover:text-on-primary"
                  >
                    Next page
                  </Link>
                ) : null}
              </nav>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
