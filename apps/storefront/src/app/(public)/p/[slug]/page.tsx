import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCmsPageAncestorTrail,
  getCmsPageBreadcrumbTrail,
  loadCmsPagePreviewPublic,
  loadCmsPagePublic,
} from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { CmsBlocksRenderer } from "@/components/CmsBlocksRenderer";
import { canonicalUrl } from "@/lib/seo";
import { createStorefrontAnonSupabase } from "@/lib/storefront-supabase";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string | string[] }>;
};

function singlePreviewToken(raw: string | string[] | undefined): string | undefined {
  if (raw == null) return undefined;
  const s = Array.isArray(raw) ? raw[0] : raw;
  const t = typeof s === "string" ? s.trim() : "";
  return t || undefined;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const preview = singlePreviewToken((await searchParams).preview);
  const locale = "en";
  let page = preview ? await loadCmsPagePreviewPublic(slug, preview, locale) : null;
  if (!page) page = await loadCmsPagePublic(slug, locale);
  if (!page) {
    return { title: "Page" };
  }
  const title = page.meta_title?.trim() || page.title || slug;
  const description = page.meta_description?.trim() || undefined;
  const canonical = page.canonical_url?.trim() || canonicalUrl(`/p/${slug}`);
  const base: Metadata = {
    title,
    description,
    alternates: { canonical },
    openGraph: page.og_image_url
      ? {
          images: [{ url: page.og_image_url, alt: title }],
        }
      : undefined,
  };
  if (preview) {
    return { ...base, robots: { index: false, follow: false } };
  }
  return base;
}

export default async function CmsDynamicPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const preview = singlePreviewToken((await searchParams).preview);
  const locale = "en";
  let page = preview ? await loadCmsPagePreviewPublic(slug, preview, locale) : null;
  if (!page) page = await loadCmsPagePublic(slug, locale);
  if (!page) notFound();

  const sb = createStorefrontAnonSupabase();
  const organizationId = process.env.DEFAULT_ORGANIZATION_ID?.trim() || undefined;
  let crumbs: { label: string; href: string }[] = [];
  if (sb) {
    if (preview) {
      const ancestors = await getCmsPageAncestorTrail(
        sb,
        page.parent_slug,
        locale,
        8,
        organizationId,
      );
      const lab = page.breadcrumb_label?.trim() || page.title?.trim() || page.slug;
      crumbs = [...ancestors, { label: lab, href: `/p/${page.slug}` }];
    } else {
      crumbs = await getCmsPageBreadcrumbTrail(sb, slug, locale, 8, organizationId);
    }
  }

  const jsonLd = page.json_ld;
  return (
    <main className="storefront-page-shell max-w-3xl">
      {jsonLd != null ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      {preview ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Preview mode. Shoppers only see this page when they use this preview link.
        </div>
      ) : null}
      {crumbs.length > 1 ? (
        <nav aria-label="Breadcrumb" className="mb-6 text-sm text-on-surface-variant">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {crumbs.map((c, i) => (
              <li key={`${c.href}-${i}`} className="flex items-center gap-2">
                {i > 0 ? (
                  <span aria-hidden className="text-on-surface-variant/40">
                    /
                  </span>
                ) : null}
                {i === crumbs.length - 1 ? (
                  <span className="font-medium text-on-surface">{c.label}</span>
                ) : (
                  <Link href={c.href} className="underline hover:text-primary">
                    {c.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        {page.title}
      </h1>
      {page.body.trim() ? (
        <div
          className="mt-8 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant"
          dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(page.body) }}
        />
      ) : null}
      <CmsBlocksRenderer blocks={page.blocks} />
    </main>
  );
}
