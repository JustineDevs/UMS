import { loadCmsBlogListPublic } from "@universal-music-store/platform-data";
import { fetchCategorySummaries } from "@/lib/catalog-fetch";
import { canonicalUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const revalidate = 3600;

export async function GET() {
  const [blogPosts, categories] = await Promise.all([
    loadCmsBlogListPublic("en").catch(() => []),
    fetchCategorySummaries().catch(() => ({ kind: "err" as const, summaries: [] })),
  ]);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    "## Start here",
    `- [Home](${canonicalUrl("/")})`,
    `- [Shop](${canonicalUrl("/shop")})`,
    `- [Collections](${canonicalUrl("/collections")})`,
    `- [Help center](${canonicalUrl("/help")})`,
    `- [FAQ](${canonicalUrl("/faq")})`,
    "",
    "## Store support",
    `- [Contact us](${canonicalUrl("/contact")})`,
    `- [Shipping](${canonicalUrl("/shipping")})`,
    `- [Returns & exchanges](${canonicalUrl("/returns")})`,
    `- [Privacy policy](${canonicalUrl("/privacy")})`,
    `- [Terms](${canonicalUrl("/terms")})`,
    "",
    "## Recent blog posts",
    ...(blogPosts.slice(0, 8).map((post) => `- [${post.title}](${canonicalUrl(`/blog/${encodeURIComponent(post.slug)}`)})`)),
    "",
    "## Popular categories",
    ...(categories.kind === "ok"
      ? categories.summaries.slice(0, 10).map((category) => `- [${category.category}](${canonicalUrl(`/shop?category=${encodeURIComponent(category.category)}`)})`)
      : []),
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
