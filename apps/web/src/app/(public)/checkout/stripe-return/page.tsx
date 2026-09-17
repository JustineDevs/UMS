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

export default async function StripeCheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_session?: string }>;
}) {
  const sp = await searchParams;
  return (
    <HostedCheckoutReturn
      provider="stripe"
      status="success"
      providerOrderId={sp.stripe_session}
    />
  );
}
