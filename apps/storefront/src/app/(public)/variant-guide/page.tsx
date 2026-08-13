import type { Metadata } from "next";
import Link from "next/link";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Variant Guide",
  description:
    "Learn how to choose the right instrument type and finish for your setup.",
  path: "/variant-guide",
  keywords: [...SEO_KEYWORDS.home, ...SEO_KEYWORDS.shop],
});

const TYPES = [
  { type: "Electric Guitar", detail: "Bright, amplified tone for stage and studio work." },
  { type: "Acoustic Guitar", detail: "Natural resonance for unplugged sessions and practice." },
  { type: "Bass Guitar", detail: "Low-end foundation for groove and rhythm sections." },
  { type: "Keyboard", detail: "Portable keys for composing, arranging, and performing." },
  { type: "Drums", detail: "Acoustic or electronic kits for live and tracked percussion." },
];

const FINISHES = [
  { finish: "Black", detail: "A classic stage-ready look that hides wear well." },
  { finish: "Natural", detail: "Shows wood grain and a more traditional instrument feel." },
  { finish: "Sunburst", detail: "Vintage-inspired color transitions with strong visual depth." },
  { finish: "White", detail: "Clean, modern presentation with high contrast on stage." },
];

export default function VariantGuidePage() {
  return (
    <main className="storefront-page-shell max-w-4xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Variant Guide
      </h1>
      <p className="mt-3 text-sm text-on-surface-variant">
        Use this guide to choose the instrument type and finish that best fit your sound, setup,
        and stage presence. If you need help choosing,{" "}
        <Link href="/contact" className="text-primary underline">
          contact us
        </Link>
        .
      </p>

      <section className="mt-10">
        <h2 className="mb-4 font-headline text-xl font-bold text-on-surface">
          How to choose a type
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {TYPES.map((item) => (
            <article
              key={item.type}
              className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4"
            >
              <h3 className="font-semibold text-on-surface">{item.type}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-headline text-xl font-bold text-on-surface">
          Choosing a finish
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {FINISHES.map((item) => (
            <article
              key={item.finish}
              className="rounded-xl border border-outline-variant/20 bg-surface-container-low p-4"
            >
              <h3 className="font-semibold text-on-surface">{item.finish}</h3>
              <p className="mt-2 text-sm text-on-surface-variant">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl bg-surface-container-low px-6 py-5">
        <h2 className="mb-2 font-headline text-base font-bold text-on-surface">
          Need a recommendation?
        </h2>
        <p className="text-sm text-on-surface-variant">
          Tell us which instrument you play and how you plan to use it. We will help narrow the
          options before you place an order.
        </p>
      </section>
    </main>
  );
}
