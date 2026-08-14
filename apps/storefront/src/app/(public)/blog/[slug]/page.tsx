import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadCmsBlogPostPublic } from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import {
  buildJsonLdArticle,
  buildJsonLdBreadcrumb,
  buildPageMetadata,
  SEO_KEYWORDS,
} from "@/lib/seo";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadCmsBlogPostPublic(slug, "en");
  if (!post) return { title: "Post" };
  const title = post.meta_title?.trim() || post.title;
  return buildPageMetadata({
    title,
    description: post.meta_description?.trim() || post.excerpt || undefined,
    path: `/blog/${slug}`,
    keywords: [...SEO_KEYWORDS.blog, ...(post.author_name ? [post.author_name] : [])],
    openGraphType: "article",
    image: post.cover_image_url ?? undefined,
    imageAlt: post.title,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await loadCmsBlogPostPublic(slug, "en");
  if (!post) notFound();

  const jsonLd =
    post.json_ld ??
    buildJsonLdArticle({
      headline: post.title,
      description: post.meta_description?.trim() || post.excerpt || undefined,
      path: `/blog/${slug}`,
      datePublished: post.published_at ?? post.created_at,
      dateModified: post.updated_at,
      authors: post.author_name ? [{ name: post.author_name }] : [],
      image: post.cover_image_url ?? undefined,
    });
  const breadcrumbJsonLd = buildJsonLdBreadcrumb([
    { name: "Home", href: "/" },
    { name: "Journal", href: "/blog" },
    { name: post.title, href: `/blog/${slug}` },
  ]);

  return (
    <article className="storefront-page-shell max-w-3xl">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1 text-xs text-on-surface-variant">
        <Link href="/" className="hover:text-primary">Home</Link>
        <span aria-hidden="true" className="select-none">/</span>
        <Link href="/blog" className="hover:text-primary">Journal</Link>
        <span aria-hidden="true" className="select-none">/</span>
        <span className="text-primary font-medium" aria-current="page">{post.title}</span>
      </nav>
      <header>
        <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">{post.title}</h1>
        {post.author_name ? (
          <p className="mt-2 text-sm text-on-surface-variant">By {post.author_name}</p>
        ) : null}
      </header>
      {post.cover_image_url ? (
        <div className="relative mt-8 aspect-video w-full overflow-hidden rounded-xl bg-surface-container-low">
          <Image
            src={post.cover_image_url}
            alt={post.title ? `${post.title} cover` : "Blog cover"}
            fill
            sizes="(max-width: 768px) 100vw, 48rem"
            className="object-cover"
            priority
            unoptimized={shouldUnoptimizeImage(post.cover_image_url)}
          />
        </div>
      ) : null}
      <div
        className="mt-10 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant"
        dangerouslySetInnerHTML={{ __html: sanitizeCmsHtml(post.body) }}
      />
    </article>
  );
}
