import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createSupabaseClient, getCmsBlogPostBySlugPreview } from "@universal-music-store/platform-data";
import { sanitizeCmsHtml } from "@universal-music-store/validation";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Blog preview",
};

type Props = {
  searchParams: Promise<{ slug?: string; locale?: string; token?: string }>;
};

export default async function BlogPreviewPage({ searchParams }: Props) {
  const sp = await searchParams;
  const slug = sp.slug?.trim();
  const token = sp.token?.trim();
  const locale = (sp.locale ?? "en").trim() || "en";
  if (!slug || !token) notFound();

  let sb: ReturnType<typeof createSupabaseClient>;
  try {
    sb = createSupabaseClient();
  } catch {
    notFound();
  }

  const post = await getCmsBlogPostBySlugPreview(sb, slug, locale, token);
  if (!post) notFound();

  const jsonLd = post.json_ld;

  return (
    <article className="storefront-page-shell max-w-3xl">
      <p className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        Preview only. This URL is not indexed.
      </p>
      {jsonLd != null ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
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
            alt=""
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
