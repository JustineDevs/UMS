import type { MetadataRoute } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN, loadCmsSitemapEntries } from "@universal-music-store/sdk";
import { fetchCategorySummaries, fetchProductSlugsForSitemap } from "@/lib/catalog-fetch";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? DEFAULT_PUBLIC_SITE_ORIGIN).replace(/\/$/, "");
  const staticPaths = [
    "",
    "/shop",
    "/collections",
    "/about",
    "/search",
    "/blog",
    "/contact",
    "/help",
    "/faq",
    "/privacy",
    "/terms",
    "/sitemap",
    "/cookies",
    "/accessibility",
    "/shipping",
    "/returns",
    "/warranty",
    "/variant-guide",
    "/preferences",
  ];
  const out: MetadataRoute.Sitemap = [];
  const seen = new Set<string>();
  const add = (entry: MetadataRoute.Sitemap[number]) => {
    if (seen.has(entry.url)) return;
    seen.add(entry.url);
    out.push(entry);
  };
  for (const path of staticPaths) {
    add({
      url: `${base}${path}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1.0 : path === "/shop" ? 0.9 : 0.6,
    });
  }

  try {
    const [slugs, categories] = await Promise.all([
      fetchProductSlugsForSitemap(),
      fetchCategorySummaries(),
    ]);
    for (const slug of slugs) {
      add({
        url: `${base}/shop/${encodeURIComponent(slug)}`,
        lastModified: new Date(),
        changeFrequency: "daily" as const,
        priority: 0.8,
      });
    }
    if (categories.kind === "ok") {
      for (const category of categories.summaries) {
        add({
          url: `${base}/collections/${encodeURIComponent(category.handle)}`,
          lastModified: new Date(),
          changeFrequency: "daily",
          priority: 0.7,
        });
      }
    }
  } catch {
    /* Medusa optional at build time */
  }

  try {
    const { pages, posts } = await loadCmsSitemapEntries();
    for (const p of pages) {
      add({
        url: `${base}/p/${encodeURIComponent(p.slug)}`,
        lastModified: new Date(p.updated_at),
        changeFrequency: "monthly" as const,
        priority: 0.5,
      });
    }
    for (const p of posts) {
      add({
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
