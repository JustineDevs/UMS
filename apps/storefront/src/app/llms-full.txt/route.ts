import { loadCmsBlogListPublic } from "@universal-music-store/platform-data";
import { fetchCategorySummaries } from "@/lib/catalog-fetch";
import { canonicalUrl, SITE_NAME, SITE_DESCRIPTION } from "@/lib/seo";

export const revalidate = 3600;

export async function GET() {
  const [blogPosts, categories] = await Promise.all([
    loadCmsBlogListPublic("en").catch(() => []),
    fetchCategorySummaries().catch(() => ({ kind: "err" as const, summaries: [] })),
  ]);

  const sections: string[] = [
    `# ${SITE_NAME}`,
    "",
    SITE_DESCRIPTION,
    "",
    "## Key pages",
    `- ${canonicalUrl("/")}`,
    `- ${canonicalUrl("/shop")}`,
    `- ${canonicalUrl("/collections")}`,
    `- ${canonicalUrl("/blog")}`,
    `- ${canonicalUrl("/faq")}`,
    `- ${canonicalUrl("/help")}`,
    `- ${canonicalUrl("/contact")}`,
    `- ${canonicalUrl("/shipping")}`,
    `- ${canonicalUrl("/returns")}`,
    `- ${canonicalUrl("/privacy")}`,
    `- ${canonicalUrl("/terms")}`,
    "",
    "## Blog index",
    ...blogPosts.slice(0, 20).flatMap((post) => [
      `### ${post.title}`,
      `- URL: ${canonicalUrl(`/blog/${encodeURIComponent(post.slug)}`)}`,
      post.excerpt ? `- Summary: ${post.excerpt}` : "- Summary: Not provided",
      post.author_name ? `- Author: ${post.author_name}` : "- Author: Not provided",
      "",
    ]),
    "## Category index",
    ...((categories.kind === "ok" ? categories.summaries : []).slice(0, 20).flatMap((category) => [
      `### ${category.category}`,
      `- URL: ${canonicalUrl(`/shop?category=${encodeURIComponent(category.category)}`)}`,
      `- Active products: ${category.count}`,
      "",
    ])),
  ];

  return new Response(sections.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
