import type { Metadata } from "next";
import Link from "next/link";
import { loadCmsPagePublic } from "@universal-music-store/platform-data";
import { CmsBlocksRenderer } from "@/components/CmsBlocksRenderer";
import { buildJsonLdFaq, buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const revalidate = 120;

export const metadata: Metadata = buildPageMetadata({
  title: "FAQ",
  description:
    "Answers about shipping, returns, exchanges, carrier timelines, and order support.",
  path: "/faq",
  keywords: [...SEO_KEYWORDS.faq],
});

const STATIC_FAQS = [
  {
    q: "Can I exchange instruments or variants?",
    a: (
      <>
        Eligible unused items may qualify within <strong>7 days</strong>.
        See{" "}
        <Link href="/returns" className="underline">
          Returns
        </Link>
        .
      </>
    ),
  },
  {
    q: "Wrong or defective item?",
    a: <>Contact us with photos and order number for replacement, exchange, or refund after review.</>,
  },
  {
    q: "Track my order",
    a: (
      <>
        Use{" "}
        <Link href="/track" className="underline">
          Track order
        </Link>
        .
      </>
    ),
  },
  {
    q: "Carriers",
    a: (
      <>
        Nationwide couriers including J&amp;T. See{" "}
        <Link href="/shipping" className="underline">
          Shipping
        </Link>
        .
      </>
    ),
  },
];

const STATIC_FAQ_SCHEMA = [
  {
    question: "Can I exchange instruments or variants?",
    answer:
      "Eligible unused items may qualify within 7 days. See Returns for details.",
  },
  {
    question: "Wrong or defective item?",
    answer:
      "Contact us with photos and order number for replacement, exchange, or refund after review.",
  },
  {
    question: "Track my order",
    answer: "Use the Track order page.",
  },
  {
    question: "Carriers",
    answer:
      "Nationwide couriers including J&T. See Shipping for the current shipping details.",
  },
] as const;

export default async function FaqPage() {
  const cmsPage = await loadCmsPagePublic("faq", "en").catch(() => null);
  const cmsBlocks = cmsPage?.blocks ?? [];
  const hasCmsContent = cmsBlocks.length > 0;
  const faqJsonLd = hasCmsContent ? null : buildJsonLdFaq([...STATIC_FAQ_SCHEMA]);

  return (
    <main className="storefront-page-shell max-w-3xl">
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        {cmsPage?.title?.trim() || "FAQ"}
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        For case-specific help,{" "}
        <Link href="/contact" className="text-primary underline">
          contact us
        </Link>
        .
      </p>

      {hasCmsContent ? (
        <div className="mt-10">
          {await CmsBlocksRenderer({ blocks: cmsBlocks })}
        </div>
      ) : (
        <dl className="mt-10 space-y-4">
          {STATIC_FAQS.map((item) => (
            <details
              key={item.q}
              className="rounded-lg border border-outline-variant/20 bg-surface-container-lowest p-4"
            >
              <summary className="cursor-pointer font-headline text-sm font-bold text-primary">
                {item.q}
              </summary>
              <p className="mt-3 text-sm text-on-surface-variant">{item.a}</p>
            </details>
          ))}
        </dl>
      )}
    </main>
  );
}
