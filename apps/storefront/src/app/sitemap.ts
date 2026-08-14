import type { MetadataRoute } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN, loadCmsSitemapEntries } from "@universal-music-store/sdk";
import { fetchProductSlugsForSitemap } from "@/lib/catalog-fetch";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN).replace(/\/$/, "");
  const staticPaths = [
    "",
    "/shop",
    "/collections",
    "/search",
    "/blog",
    "/contact",
    "/help",
    "/faq",
    "/privacy",
    "/terms",
    "/sitemap",
  ];
  const out: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: path === "" ? 1.0 : path === "/shop" ? 0.9 : 0.6,
  }));

  try {
    const slugs = await fetchProductSlugsForSitemap(2000);
    for (const slug of slugs) {
      out.push({
        url: `${base}/shop/${encodeURIComponent(slug)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      });
    }
  } catch {
    /* Medusa optional at build time */
  }

  try {
    const { pages, posts } = await loadCmsSitemapEntries();
    for (const p of pages) {
      out.push({
        url: `${base}/p/${encodeURIComponent(p.slug)}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    }
    for (const p of posts) {
      out.push({
        url: `${base}/blog/${encodeURIComponent(p.slug)}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    }
  } catch {
    /* Supabase optional in dev */
  }

  return out;
}
