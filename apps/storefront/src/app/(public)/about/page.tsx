import Link from "next/link";
import type { Metadata } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@universal-music-store/sdk";
import { loadCmsPagePublic } from "@universal-music-store/platform-data";
import { CmsBlocksRenderer } from "@/components/CmsBlocksRenderer";
import { buildPageMetadata, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const revalidate = 120;

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await loadCmsPagePublic("about", "en").catch(() => null);
  return buildPageMetadata({
    title: cmsPage?.meta_title?.trim() || cmsPage?.title?.trim() || `About | ${SITE_NAME}`,
    description:
      cmsPage?.meta_description?.trim() ||
      `Learn about ${SITE_NAME}, a Philippine music store for instruments and working musicians.`,
    path: "/about",
    image: cmsPage?.og_image_url?.trim() || undefined,
  });
}

export default async function AboutPage() {
  const cmsPage = await loadCmsPagePublic("about", "en").catch(() => null);
  const cmsBlocks = cmsPage?.blocks ?? [];
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_PUBLIC_SITE_ORIGIN).replace(/\/$/, "");
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: `${siteUrl}/about`,
    description: "A Philippine music store for instruments and working musicians.",
    areaServed: "PH",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      url: `${siteUrl}/contact`,
    },
  };

  return (
    <main className="storefront-page-shell max-w-[1200px]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <header className="max-w-3xl">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-secondary">{SITE_NAME}</p>
        <h1 className="font-headline text-4xl font-bold tracking-tighter text-primary sm:text-6xl">{cmsPage?.title?.trim() || "Music gear that earns its place."}</h1>
        <p className="mt-6 text-lg leading-8 text-on-surface-variant">{cmsPage?.meta_description?.trim() || SITE_DESCRIPTION}</p>
      </header>
      {cmsBlocks.length > 0 ? <div className="mt-16"><CmsBlocksRenderer blocks={cmsBlocks} /></div> : <div className="mt-16 grid gap-8 md:grid-cols-3">
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h2 className="font-headline text-xl font-bold text-primary">Curated for players</h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">We focus on dependable instruments and useful gear, with product details that help you choose with confidence.</p>
        </section>
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h2 className="font-headline text-xl font-bold text-primary">Built for the Philippines</h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">Local delivery, clear checkout totals, and support access are part of the shopping experience, not an afterthought.</p>
        </section>
        <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-6">
          <h2 className="font-headline text-xl font-bold text-primary">Here after checkout</h2>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">Your account and order tools keep delivery updates, returns, and support within reach.</p>
        </section>
      </div>}
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href="/shop" className="inline-flex rounded-lg bg-primary px-5 py-3 text-sm font-bold text-on-primary">Browse the shop</Link>
        <Link href="/contact" className="inline-flex rounded-lg border border-outline-variant/30 px-5 py-3 text-sm font-semibold text-primary">Contact support</Link>
      </div>
    </main>
  );
}
