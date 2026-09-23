import type { Metadata } from "next";
import { HostedCheckoutReturn } from "@/components/HostedCheckoutReturn";
import {
  normalizeHostedReturnProvider,
  normalizeHostedReturnStatus,
} from "@/lib/hosted-payment-return";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Payment return",
  description: "Return page after hosted checkout.",
  path: "/checkout/hosted-return",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default async function HostedReturnPage({
  searchParams,
}: {
  searchParams: Promise<{
    provider?: string;
    status?: string;
    session_id?: string;
    token?: string;
    stripe_session?: string;
  }>;
}) {
  const sp = await searchParams;
  const provider = normalizeHostedReturnProvider(sp.provider);
  const status = normalizeHostedReturnStatus(sp.status);
  const providerOrderId =
    typeof sp.session_id === "string"
      ? sp.session_id
      : typeof sp.token === "string"
      ? sp.token
      : typeof sp.stripe_session === "string"
        ? sp.stripe_session
        : undefined;
  return <HostedCheckoutReturn provider={provider} status={status} providerOrderId={providerOrderId} />;
}
