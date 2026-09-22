import { unstable_cache } from "next/cache";
import {
  DEFAULT_STOREFRONT_HOME_PAYLOAD,
  loadStorefrontHomeContentForPublic,
  storefrontSocialLinks,
} from "@universal-music-store/platform-data";
import Link from "next/link";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
import { HomeScrollExperience } from "@/components/home/HomeScrollExperience";
import { StorefrontHomePreviewBridge } from "@/components/StorefrontHomePreviewBridge";
import { fetchFeaturedProducts } from "@/lib/catalog-fetch";
import {
  fetchHomepageCustomerCount,
  fetchHomepageSocialProof,
} from "@/lib/homepage-social-proof";
import {
  buildJsonLdOrganization,
  buildJsonLdWebSite,
  buildPageMetadata,
  serializeJsonLd,
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/seo";
import { getCachedPublicSiteMetadata } from "@/lib/public-site-metadata";

const getCachedPublicHomeContent = unstable_cache(
  loadStorefrontHomeContentForPublic,
  ["storefront-home-content"],
  { revalidate: 60, tags: ["storefront:home"] },
);

const HOME_CONTENT_DEADLINE_MS = 1_500;
const HOME_AUXILIARY_READ_DEADLINE_MS = 1_500;

function loadHomeContentWithinDeadline() {
  return Promise.race([
    getCachedPublicHomeContent(),
    new Promise<typeof DEFAULT_STOREFRONT_HOME_PAYLOAD>((resolve) =>
      setTimeout(() => resolve(DEFAULT_STOREFRONT_HOME_PAYLOAD), HOME_CONTENT_DEADLINE_MS),
    ),
  ]);
}

function loadHomepageAuxiliaryReadWithinDeadline<T>(read: Promise<T>, fallback: T) {
  return Promise.race([
    read,
    new Promise<T>((resolve) =>
      setTimeout(() => resolve(fallback), HOME_AUXILIARY_READ_DEADLINE_MS),
    ),
  ]);
}

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: SITE_NAME,
  description: "Browse Universal Music Store for guitars, bass, drums, keyboards, and accessories in the Philippines.",
  path: "/",
  keywords: [...SEO_KEYWORDS.home],
});

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ adminPreview?: string | string[] }>;
}) {
  const adminPreview = (await searchParams).adminPreview;
  const isAdminPreview =
    adminPreview === "1" ||
    (Array.isArray(adminPreview) && adminPreview.includes("1"));
  const [featured, home] = await Promise.all([
    fetchFeaturedProducts(4),
    loadHomeContentWithinDeadline(),
  ]);
  if (featured.kind !== "ok" && !isAdminPreview) {
    return (
      <main className="storefront-page-shell max-w-[1600px] pb-12">
        <div className="mx-auto max-w-2xl space-y-6 pt-8">
          <div>
            <h1 className="font-headline text-3xl font-extrabold text-primary">
              {SITE_NAME}
            </h1>
            <p className="mt-2 text-on-surface-variant">
              The storefront is not loading products right now. When the catalog
              is available, you can browse, order, and track shipments.{" "}
              <Link
                href="/privacy"
                className="font-medium text-primary underline underline-offset-4"
              >
                Privacy policy
              </Link>
            </p>
          </div>
          <StorefrontCommerceAlert failure={featured} />
        </div>
      </main>
    );
  }

  const [customerCount, reviewSummary, publicMeta] = await Promise.all([
    loadHomepageAuxiliaryReadWithinDeadline(fetchHomepageCustomerCount(), 0),
    loadHomepageAuxiliaryReadWithinDeadline(fetchHomepageSocialProof(), { average: 0, count: 0 }),
    loadHomepageAuxiliaryReadWithinDeadline(
      getCachedPublicSiteMetadata().catch(() => null),
      null,
    ),
  ]);
  const orgJsonLd = buildJsonLdOrganization({
    sameAs: publicMeta ? storefrontSocialLinks(publicMeta).map((link) => link.href) : [],
    contactEmail: publicMeta?.supportEmail ?? null,
    contactPhone: publicMeta?.supportPhone ?? null,
  });
  const webJsonLd = buildJsonLdWebSite();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webJsonLd) }}
      />
      {isAdminPreview ? (
        <StorefrontHomePreviewBridge
          products={featured.kind === "ok" ? featured.products : []}
          home={home}
          socialProof={{ customerCount, reviewSummary }}
        />
      ) : (
        <HomeScrollExperience
          products={featured.kind === "ok" ? featured.products : []}
          home={home}
          socialProof={{ customerCount, reviewSummary }}
          visualBlocks={home.visualBlocks}
        />
      )}
    </>
  );
}
