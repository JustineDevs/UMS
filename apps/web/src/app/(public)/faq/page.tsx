import type { Metadata } from "next";
import Link from "next/link";
import { loadCmsPagePublic } from "@universal-music-store/platform-data";
import { CmsBlocksRenderer } from "@/components/CmsBlocksRenderer";
import { Faq4 } from "@universal-music-store/ui";
import { buildJsonLdFaq, buildPageMetadata, serializeJsonLd, SEO_KEYWORDS } from "@/lib/seo";

export const revalidate = 120;

export const metadata: Metadata = buildPageMetadata({
  title: "FAQ",
  description:
    "Answers about shipping, returns, exchanges, carrier timelines, and order support.",
  path: "/faq",
  keywords: [...SEO_KEYWORDS.faq],
});

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
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqJsonLd) }}
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
        <Faq4
          className="mt-6 max-w-none px-0 py-8"
          badge="Customer support"
          title="Frequently asked questions"
          description="Clear answers about ordering, delivery, returns, and support from Universal Music Store."
          buttonText="Contact support"
          buttonHref="/contact"
          faqs={STATIC_FAQ_SCHEMA.map((item, index) => ({
            id: `faq-${index + 1}`,
            question: item.question,
            answer: item.answer,
          }))}
        />
      )}
    </main>
  );
}
