import type { Metadata } from "next";
import Link from "next/link";
import { loadCmsBlogListPublic } from "@universal-music-store/platform-data";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Journal",
  description: "Articles and updates from the store team about products, buying guides, and store news.",
  path: "/blog",
  keywords: [...SEO_KEYWORDS.blog],
});

export default async function BlogIndexPage() {
  const posts = await loadCmsBlogListPublic("en");
  return (
    <main className="storefront-page-shell max-w-3xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">Journal</h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        News, product notes, and editorial posts from the team.
      </p>
      <ul className="mt-10 space-y-6">
        {posts.map((p) => (
          <li key={p.id} className="border-b border-outline-variant/20 pb-6">
            <Link href={`/blog/${encodeURIComponent(p.slug)}`} className="group block">
              <h2 className="font-headline text-xl font-bold text-primary group-hover:underline">
                {p.title}
              </h2>
              {p.excerpt ? (
                <p className="mt-2 font-body text-sm text-on-surface-variant">{p.excerpt}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
      {posts.length === 0 ? (
        <p className="mt-8 text-sm text-on-surface-variant">No posts published yet.</p>
      ) : null}
    </main>
  );
}
