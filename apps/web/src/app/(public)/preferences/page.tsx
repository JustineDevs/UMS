import type { Metadata } from "next";
import { PreferencesControls } from "@/components/PreferencesControls";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Local storefront preferences",
  description: "Device-local language, measurement, layout, and motion preferences.",
  path: "/preferences",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function PreferencesPage() {
  return (
    <main className="storefront-page-shell max-w-2xl">
      <h1 className="font-headline text-3xl font-bold text-primary sm:text-4xl">
        Local storefront preferences
      </h1>
      <div className="mt-8 space-y-6 font-body text-sm leading-relaxed text-on-surface-variant">
        <PreferencesControls />
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Checkout currency
          </h2>
          <p>
            All prices and checkout totals are controlled by the store and payment
            context. This device setting does not change the checkout currency.
          </p>
        </section>
        <section>
          <h2 className="font-headline text-lg font-bold text-primary">
            Shipping availability
          </h2>
          <p>
            Fulfillment is optimized for the <strong>Philippines</strong>.
            International delivery may be unavailable or quoted case-by-case;
            this device setting does not change delivery eligibility.
          </p>
        </section>
      </div>
    </main>
  );
}
