import type { Metadata } from "next";
import { HostedCheckoutReturn } from "@/components/HostedCheckoutReturn";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Payment return",
  description: "Return page after Stripe checkout.",
  path: "/checkout/stripe-return",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function StripeCheckoutReturnPage() {
  return <HostedCheckoutReturn provider="stripe" status="success" />;
}
