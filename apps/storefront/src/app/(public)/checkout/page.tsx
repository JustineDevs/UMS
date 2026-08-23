import type { Metadata } from "next";
import { CheckoutClient } from "./checkout-client";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Checkout",
  description: "Complete your order and review shipping, payment, and delivery details.",
  path: "/checkout",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    resume?: string;
    token?: string;
    stripe_cancel?: string;
    review?: string;
    message?: string;
    guest?: string;
  }>;
}) {
  const sp = await searchParams;
  const resume = sp.resume?.trim();
  const token = sp.token?.trim();
  const stripeCancel =
    sp.stripe_cancel === "1" ||
    sp.stripe_cancel === "true" ||
    sp.stripe_cancel === "yes";
  const review =
    sp.review === "1" || sp.review === "true" || sp.review === "yes";
  const initialReviewMessage =
    review && typeof sp.message === "string" && sp.message.trim()
      ? sp.message.trim()
      : undefined;
  const guestMode = sp.guest === "1" || sp.guest === "true";
  return (
    <CheckoutClient
      initialResumeCartId={resume}
      initialResumeToken={token}
      initialStripeCheckoutCancel={stripeCancel}
      initialReviewMessage={initialReviewMessage}
      guestMode={guestMode}
    />
  );
}
