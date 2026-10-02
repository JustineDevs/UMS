import type { Metadata } from "next";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";
import { StorefrontPageFrame, StorefrontPageHeader } from "@/components/storefront/StorefrontPagePrimitives";
import { TrackRedirectForm } from "./TrackRedirectForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = buildPageMetadata({
  title: "Track order",
  description: "Open a secure tracking link to view delivery status.",
  path: "/track",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function TrackRedirectPage() {
  return (
    <StorefrontPageFrame width="narrow">
      <StorefrontPageHeader
        title="Track your order"
        description="Paste the secure tracking link from your confirmation email. Raw order numbers and separate tracking codes are not accepted."
      />
      <TrackRedirectForm />
    </StorefrontPageFrame>
  );
}
