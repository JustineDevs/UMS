import type { Metadata } from "next";
import { PreferencesControls } from "@/components/PreferencesControls";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import {
  StorefrontPageFrame,
  StorefrontPageHeader,
  StorefrontPolicySection,
} from "@/components/storefront/StorefrontPagePrimitives";

export const metadata: Metadata = buildPageMetadata({
  title: "Local storefront preferences",
  description:
    "Device-local language, measurement, layout, and motion preferences.",
  path: "/preferences",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function PreferencesPage() {
  return (
    <StorefrontPageFrame width="narrow">
      <StorefrontPageHeader
        title="Local storefront preferences"
        description="Manage device-local language, measurement, layout, and motion preferences."
      />
      <div className="mt-8 space-y-7 font-body text-sm leading-relaxed text-on-surface-variant">
        <PreferencesControls />
        <StorefrontPolicySection title="Checkout currency">
          <p>
            All prices and checkout totals are controlled by the store and
            payment context. This device setting does not change the checkout
            currency.
          </p>
        </StorefrontPolicySection>
        <StorefrontPolicySection title="Shipping availability">
          <p>
            Fulfillment is optimized for the <strong>Philippines</strong>.
            International delivery may be unavailable or quoted case-by-case;
            this device setting does not change delivery eligibility.
          </p>
        </StorefrontPolicySection>
      </div>
    </StorefrontPageFrame>
  );
}
