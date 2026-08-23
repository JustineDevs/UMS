import nextDynamic from "next/dynamic";
import { loadStorefrontHomeContentForPublic, storefrontSocialLinks } from "@universal-music-store/platform-data";
import Link from "next/link";
import { StorefrontCommerceAlert } from "@/components/StorefrontCommerceAlert";
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
  SEO_KEYWORDS,
  SITE_NAME,
} from "@/lib/seo";
import { getCachedPublicSiteMetadata } from "@/lib/public-site-metadata";

const HomeScrollExperience = nextDynamic(
  () =>
    import("@/components/home/HomeScrollExperience").then((m) => ({
      default: m.HomeScrollExperience,
    })),
  {
    loading: () => (
      <div
        className="min-h-[min(72svh,40rem)] w-full animate-pulse bg-surface-container-low"
        aria-hidden
      />
    ),
    ssr: true,
  },
);

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
    loadStorefrontHomeContentForPublic(),
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

  const [customerCount, reviewSummary] = await Promise.all([
    fetchHomepageCustomerCount(),
    fetchHomepageSocialProof(),
  ]);
  const publicMeta = await getCachedPublicSiteMetadata().catch(() => null);
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webJsonLd) }}
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
        />
      )}
    </>
  );
}
