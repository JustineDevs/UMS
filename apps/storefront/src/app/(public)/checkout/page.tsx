import { CheckoutClient } from "./checkout-client";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    resume?: string;
    stripe_cancel?: string;
    review?: string;
    message?: string;
    guest?: string;
  }>;
}) {
  const sp = await searchParams;
  const resume = sp.resume?.trim();
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
      initialStripeCheckoutCancel={stripeCancel}
      initialReviewMessage={initialReviewMessage}
      guestMode={guestMode}
    />
  );
}
