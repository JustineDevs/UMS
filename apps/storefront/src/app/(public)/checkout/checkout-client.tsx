"use client";

import Image from "next/image";
import Link from "next/link";
import {
  PAYMENT_PROVIDER_IDS,
  PAYMENT_PROVIDER_LABELS,
  type PaymentProviderKey,
} from "@/lib/medusa-checkout";
import { updateLineQuantity } from "@/lib/cart";
import { CheckoutTrustBadges } from "@/components/CheckoutTrustBadges";
import {
  AuthoritativeTotalPanel,
  CheckoutChangeReviewCard,
  CommerceStateBanner,
  StaleSessionNotice,
} from "@/components/commerce-state";
import { PaymentProviderLogo } from "@/components/PaymentProviderLogo";
import dynamic from "next/dynamic";
import { formatCheckoutMoney } from "./checkout-utils";
import { useCheckoutClient } from "./use-checkout-client";
import { shouldUnoptimizeImage } from "@/lib/image-helpers";

const PayPalEmbeddedCheckout = dynamic(
  () =>
    import("@/components/PayPalEmbeddedCheckout").then(
      (m) => m.PayPalEmbeddedCheckout,
    ),
  { ssr: false },
);
const XenditComponentsCheckout = dynamic(
  () =>
    import("@/components/XenditComponentsCheckout").then(
      (m) => m.XenditComponentsCheckout,
    ),
  { ssr: false },
);

export function CheckoutClient({
  initialResumeCartId,
  initialStripeCheckoutCancel,
  initialReviewMessage,
  guestMode,
}: {
  initialResumeCartId?: string;
  initialStripeCheckoutCancel?: boolean;
  initialReviewMessage?: string;
  guestMode?: boolean;
}) {
  const {
    session,
    authStatus,
    lines,
    email,
    setEmail,
    error,
    setError,
    loading,
    paymentMethod,
    setPaymentMethod,
    pendingPayment,
    setPendingPayment,
    embeddedData,
    copyDone,
    setCopyDone,
    loyaltyPoints,
    setLoyaltyPoints,
    loyaltyBalance,
    hydrated,
    medusaPricePreview,
    medusaPriceStatus,
    medusaPreviewError,
    profileGate,
    setProfileGate,
    profileMissing,
    fetchProfileStatus,
    providerAvailable,
    refresh,
    localSubtotal,
    localTax,
    localTotal,
    useMedusaBagTotals,
    displayCurrency,
    handlePay,
    completeEmbeddedPayment,
    resumePendingHostedPayment,
    continueToHostedCheckout,
    copyTrackingLink,
    phVatRate,
    quoteReviewItems,
    quoteReviewRequired,
    quoteReviewAcknowledged,
    acknowledgeQuoteReview,
    foreignCheckoutActive,
    checkoutAvailabilityStatus,
    checkoutUnavailableCode,
    retryCheckoutAvailability,
    paymentAvailabilitySource,
    selectedShippingOptionId,
    setSelectedShippingOptionId,
    deliveryInstructions,
    setDeliveryInstructions,
    termsAccepted,
    setTermsAccepted,
    promoCode,
    setPromoCode,
    promoApplied,
    promoError,
    promoLoading,
    applyPromoCode,
    removePromoCode,
    guestMode: isGuestCheckout,
  } = useCheckoutClient({
    initialResumeCartId,
    initialStripeCheckoutCancel,
    initialReviewMessage,
    guestMode,
  });

  if (authStatus === "loading" && !isGuestCheckout) {
    return (
        <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="text-sm text-on-surface-variant">Loading…</p>
      </main>
    );
  }

  if ((authStatus !== "authenticated" || !session?.user) && !isGuestCheckout) {
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="font-body text-on-surface-variant mb-6 max-w-lg">
          Sign in for a faster checkout with saved address and order history. Or
          continue as a guest with card payment.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Link
            href={`/sign-in?callbackUrl=${encodeURIComponent("/checkout")}`}
            data-testid="checkout-guest-sign-in"
            className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
          >
            Sign in to continue
          </Link>
          <Link
            href="/checkout?guest=1"
            data-testid="checkout-guest-continue"
            className="inline-flex rounded border border-primary px-6 py-3 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary"
          >
            Continue as guest
          </Link>
        </div>
        <p className="mt-4 text-xs text-on-surface-variant">
          Guest checkout supports card payments only. Cash on delivery requires
          a saved delivery profile.
        </p>
      </main>
    );
  }

  if (profileGate === "loading" || profileGate === "idle") {
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="text-sm text-on-surface-variant">Loading your profile…</p>
      </main>
    );
  }

  if (profileGate === "error") {
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="font-body text-on-surface-variant mb-6 max-w-lg">
          We could not confirm your delivery profile. Check your connection and
          try again.
        </p>
        <button
          type="button"
          data-testid="checkout-profile-retry"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
          onClick={() => {
            setProfileGate("loading");
            void fetchProfileStatus().then((outcome) => {
              setProfileGate(outcome === "error" ? "error" : outcome);
            });
          }}
        >
          Retry
        </button>
      </main>
    );
  }

  if (profileGate === "incomplete") {
    const onboardingHref = `/onboarding?next=${encodeURIComponent("/checkout")}`;
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="font-body text-on-surface-variant mb-4 max-w-lg">
          Add your name, mobile number, and delivery address before you pay. You
          will return here when you are done.
        </p>
        {profileMissing.length > 0 ? (
          <ul className="mb-6 list-disc pl-5 text-sm text-on-surface-variant max-w-lg space-y-1">
            {profileMissing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : null}
        <Link
          href={onboardingHref}
          data-testid="checkout-onboarding-continue"
          className="inline-flex rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
        >
          Complete delivery details
        </Link>
      </main>
    );
  }

  if (checkoutAvailabilityStatus === "loading") {
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <p className="text-sm text-on-surface-variant">Preparing checkout…</p>
      </main>
    );
  }

  if (checkoutAvailabilityStatus === "unavailable") {
    return (
      <main className="storefront-page-shell motion-surface max-w-7xl">
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
          Checkout
        </h1>
        <div
          className="mb-6 max-w-lg rounded-lg border border-outline-variant bg-surface-container-low p-4"
          role="status"
        >
          <p className="font-body text-on-surface mb-3">
            Checkout is temporarily unavailable. Your bag is saved. You can try
            again in a moment or return to your bag.
          </p>
          {process.env.NODE_ENV === "development" && checkoutUnavailableCode ? (
            <p className="mb-3 font-mono text-xs text-on-surface-variant">
              Code: {checkoutUnavailableCode}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              data-testid="checkout-unavailable-retry"
              className="inline-flex rounded bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-90"
              onClick={() => {
                void retryCheckoutAvailability();
              }}
            >
              Try again
            </button>
            <Link
              href="/cart"
              className="inline-flex rounded border border-outline px-5 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container"
            >
              Back to bag
            </Link>
            <Link
              href="/account/orders"
              className="inline-flex rounded border border-outline px-5 py-2.5 text-sm font-semibold text-primary hover:bg-surface-container"
            >
              View orders
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="storefront-page-shell motion-surface max-w-7xl">
      <h1 className="font-headline text-4xl font-extrabold tracking-tighter text-primary mb-2">
        Checkout
      </h1>

      {/* Checkout progress indicator */}
      <nav aria-label="Checkout progress" className="mb-8">
        <ol className="flex items-center gap-0">
          {(["Address", "Shipping", "Payment", "Review"] as const).map(
            (step, i, arr) => {
              const stepIndex = i + 1;
              const activeStep =
                profileGate !== "complete"
                  ? 1
                  : !selectedShippingOptionId
                    ? 2
                    : !termsAccepted
                      ? 3
                      : 4;
              const done = stepIndex < activeStep;
              const active = stepIndex === activeStep;
              return (
                <li key={step} className="flex items-center">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors
                    ${done ? "bg-primary text-on-primary" : active ? "bg-primary/20 text-primary ring-2 ring-primary" : "bg-surface-container-high text-on-surface-variant"}`}
                    aria-current={active ? "step" : undefined}
                  >
                    {done ? (
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    ) : (
                      stepIndex
                    )}
                  </span>
                  <span
                    className={`ml-1.5 text-xs font-medium hidden sm:inline ${active ? "text-primary" : "text-on-surface-variant"}`}
                  >
                    {step}
                  </span>
                  {i < arr.length - 1 && (
                    <span
                      className="mx-2 h-px w-8 bg-outline-variant/40 sm:w-12"
                      aria-hidden="true"
                    />
                  )}
                </li>
              );
            },
          )}
        </ol>
      </nav>

      {isGuestCheckout && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low px-4 py-3 max-w-lg">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="min-w-0">
            <p className="text-sm font-medium text-on-surface">
              Continuing as guest
            </p>
            <p className="mt-0.5 text-xs text-on-surface-variant">
              Enter your email below for order updates. Cash on delivery
              requires a{" "}
              <Link href="/sign-in?callbackUrl=/checkout" className="underline">
                signed-in profile
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <p className="font-body text-on-surface-variant mb-4 max-w-lg">
        Review your bag and choose how to pay. The total on the right includes
        shipping and taxes so you know exactly what you pay before clicking the
      </p>
      <p className="font-body text-sm text-on-surface-variant mb-12 max-w-lg rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-4 py-3">
        <span className="font-headline text-[10px] font-bold uppercase tracking-widest text-primary">
          How it works
        </span>
        <span className="mt-2 block leading-relaxed">
          Your bag total loads with shipping and taxes included. Card payments
          continue to hosted Stripe Checkout. Wallet and local payment methods
          continue through the configured provider. Cash on delivery places your
          order with no card step. Your saved delivery address is used for
          fulfillment.
        </span>
      </p>

      {foreignCheckoutActive ? (
        <CommerceStateBanner
          variant="amber"
          title="Checkout active in another tab"
        >
          Continue checkout in the other window, or close that tab to place an
          order from here. This tab stays read-only until then.
        </CommerceStateBanner>
      ) : null}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)] xl:gap-12">
        <div className="space-y-8">
          {useMedusaBagTotals &&
          medusaPricePreview &&
          medusaPricePreview.shippingOptions.length > 0 ? (
            <section>
              <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
                Shipping method
              </h2>
              <div
                className="space-y-3"
                role="radiogroup"
                aria-label="Shipping method"
              >
                {medusaPricePreview.shippingOptions.map((opt) => {
                  const selected = selectedShippingOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`shipping-${opt.id}`}
                      disabled={foreignCheckoutActive}
                      onClick={() =>
                        !foreignCheckoutActive &&
                        setSelectedShippingOptionId(opt.id)
                      }
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        selected
                          ? "border-primary/40 bg-surface-container-low/40 ring-1 ring-primary/15"
                          : "border-outline-variant/20 hover:border-primary/25 hover:bg-surface-container-low/60"
                      }`}
                    >
                      <span className="min-w-0 flex-1 text-sm leading-snug">
                        {opt.name}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatCheckoutMoney(opt.priceMajor, opt.currencyCode)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}
          <section>
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
              How you will pay
            </h2>
            <div
              className="space-y-3"
              role="radiogroup"
              aria-label="How you will pay"
            >
              {(paymentAvailabilitySource === "medusa"
                ? (
                    Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[]
                  ).filter((k) => providerAvailable[k])
                : (Object.keys(PAYMENT_PROVIDER_IDS) as PaymentProviderKey[])
              ).map((key) => {
                const ok = providerAvailable[key];
                const selected = paymentMethod === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={!ok}
                    data-testid={`payment-${key.toLowerCase()}`}
                    disabled={!ok || foreignCheckoutActive}
                    onClick={() =>
                      ok && !foreignCheckoutActive && setPaymentMethod(key)
                    }
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      ok
                        ? "cursor-pointer border-outline-variant/20 hover:border-primary/25 hover:bg-surface-container-low/60"
                        : "cursor-not-allowed border-outline-variant/10 opacity-60"
                    } ${selected && ok ? "border-primary/40 bg-surface-container-low/40 ring-1 ring-primary/15" : ""}`}
                  >
                    <PaymentProviderLogo
                      providerKey={key}
                      label={PAYMENT_PROVIDER_LABELS[key]}
                    />
                    <span className="min-w-0 flex-1 text-sm leading-snug">
                      {PAYMENT_PROVIDER_LABELS[key]}
                      {!ok ? (
                        <span className="mt-0.5 block text-xs text-on-surface-variant">
                          Not available for your area or store setup right now.
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                        selected && ok ? "bg-primary" : "bg-outline-variant/35"
                      }`}
                      aria-hidden
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
                          selected && ok ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
            {paymentMethod === "COD" ? (
              <div
                className="mt-3 space-y-2 rounded-lg border border-outline-variant/15 bg-surface-container-low/40 px-3 py-3 text-xs leading-relaxed text-on-surface-variant"
                role="region"
                aria-label="Cash on delivery steps"
              >
                <p className="font-semibold text-on-surface">
                  How cash on delivery works
                </p>
                <ol className="list-decimal space-y-1.5 pl-4 text-on-surface-variant">
                  <li>
                    Confirm your bag and delivery profile (address and phone
                    from onboarding). Update them under Account if anything is
                    wrong.
                  </li>
                  <li>
                    Choose cash on delivery here, then use the button below to
                    place the order. No card or wallet step runs for this
                    option.
                  </li>
                  <li>
                    After you submit, you go to the order tracking page. We use
                    the email on your account for order updates.
                  </li>
                  <li>
                    When the rider arrives, pay in Philippine pesos for the
                    total shown on your confirmation. Keep mobile contact
                    details handy in case the courier calls.
                  </li>
                </ol>
              </div>
            ) : null}
          </section>

          <section>
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Stay in touch
            </h2>
            <label className="block text-xs font-medium text-on-surface-variant mb-2">
              Email for your receipt
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              disabled={paymentMethod === "COD" || foreignCheckoutActive}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-xs text-on-surface-variant mt-2">
              {paymentMethod === "COD" ? (
                <>
                  Cash on delivery uses the email on your account for
                  confirmations. Switch payment method if you need to type a
                  different address here.
                </>
              ) : (
                <>
                  Defaults to your sign-in email. Change it if you want order
                  updates somewhere else. We only check that the format looks
                  correct.
                </>
              )}
            </p>
            <label className="block text-xs font-medium text-on-surface-variant mt-4 mb-2">
              Loyalty points to use (optional)
            </label>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-on-surface-variant">
                Your balance: <strong>{loyaltyBalance} points</strong>
              </span>
            </div>
            <input
              type="number"
              min={0}
              max={loyaltyBalance}
              step={1}
              value={loyaltyPoints}
              onChange={(e) => setLoyaltyPoints(e.target.value)}
              placeholder="0"
              disabled={foreignCheckoutActive}
              className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-3 font-body text-sm outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            {Number(loyaltyPoints) > loyaltyBalance && (
              <p className="text-xs text-error mt-1">
                You only have {loyaltyBalance} points available.
              </p>
            )}
            <p className="text-xs text-on-surface-variant mt-2">
              Each point lowers your total by 1.00 in the shop currency.
            </p>

            <div className="mt-6 border-t border-outline-variant/15 pt-5">
              <label className="block text-xs font-medium text-on-surface-variant mb-2">
                Promotion code (optional)
              </label>
              {promoApplied ? (
                <div className="flex items-center gap-3 rounded bg-primary/10 px-4 py-3">
                  <svg
                    className="h-4 w-4 shrink-0 text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span className="flex-1 text-sm font-medium text-primary">
                    Code <strong>{promoApplied.code}</strong> applied
                    {promoApplied.discountAmount != null &&
                    promoApplied.discountAmount > 0
                      ? ` (-${formatCheckoutMoney(promoApplied.discountAmount, displayCurrency)})`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void removePromoCode(medusaPricePreview?.cartId ?? "")
                    }
                    disabled={promoLoading}
                    className="text-xs text-on-surface-variant underline hover:text-error disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter")
                        void applyPromoCode(medusaPricePreview?.cartId ?? "");
                    }}
                    placeholder="Enter code"
                    disabled={foreignCheckoutActive || promoLoading}
                    className="flex-1 bg-surface-container-lowest border border-outline-variant/30 rounded px-4 py-2.5 font-body text-sm uppercase tracking-widest outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
                    maxLength={50}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void applyPromoCode(medusaPricePreview?.cartId ?? "")
                    }
                    disabled={
                      !promoCode.trim() ||
                      promoLoading ||
                      foreignCheckoutActive ||
                      !medusaPricePreview?.cartId
                    }
                    className="rounded bg-primary px-4 py-2.5 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-50"
                  >
                    {promoLoading ? "Applying…" : "Apply"}
                  </button>
                </div>
              )}
              {promoError && (
                <p className="mt-2 text-xs text-error" role="alert">
                  {promoError}
                </p>
              )}
              {!medusaPricePreview?.cartId && !promoApplied && (
                <p className="mt-1 text-xs text-on-surface-variant/60">
                  A Medusa cart must be initialised before a code can be
                  applied. The code field is active once your bag totals load.
                </p>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Delivery and pickup
            </h2>
            <p className="text-sm text-on-surface-variant">
              Your primary saved address from onboarding is on file.
              {paymentMethod === "COD"
                ? " Cash on delivery ships to that address."
                : " Some payment methods may ask you to confirm shipping or contact details before you pay."}
            </p>
            <p className="mt-3 text-sm text-on-surface-variant leading-relaxed">
              <strong className="text-primary">
                Buy online, pick up in store:
              </strong>{" "}
              When your order supports it, choose store pickup on the payment or
              delivery step, or write &quot;Cavite pickup&quot; in order
              comments and confirm with support if you do not see pickup.
            </p>
          </section>
        </div>

        <div>
          <div className="bg-surface-container-lowest rounded-lg shadow-[0px_20px_40px_rgba(0,0,0,0.02)] p-6 border border-outline-variant/10">
            <h2 className="font-headline text-sm font-bold uppercase tracking-widest text-primary mb-6">
              Your bag
            </h2>

            {!hydrated ? (
              <p className="text-on-surface-variant text-sm py-8 text-center">
                Loading your bag…
              </p>
            ) : lines.length === 0 ? (
              <div className="space-y-4 text-center py-8">
                <p className="text-on-surface-variant text-sm">
                  Your bag is empty.
                </p>
                <Link
                  href="/shop"
                  className="inline-flex items-center justify-center text-primary font-medium text-sm hover:opacity-80 transition-opacity"
                >
                  Browse the shop
                </Link>
              </div>
            ) : (
              <ul className="space-y-4 text-sm">
                {lines.map((l) => (
                  <li
                    key={l.variantId}
                    className="flex gap-3 border-b border-surface-container-high pb-4"
                  >
                    {l.thumbnail ? (
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-outline-variant/20 bg-surface-container">
                        <Image
                          src={l.thumbnail}
                          alt={l.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                          unoptimized={shouldUnoptimizeImage(l.thumbnail)}
                        />
                      </div>
                    ) : (
                      <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-md border border-outline-variant/20 bg-surface-container">
                        <span className="text-[10px] text-on-surface-variant">
                          No img
                        </span>
                      </div>
                    )}
                    <div className="flex flex-1 justify-between gap-2 min-w-0">
                      <div className="min-w-0">
                        <p className="font-medium text-primary truncate">
                          {l.name}
                        </p>
                        <p className="text-on-surface-variant text-xs mt-0.5">
                          {[l.type, l.finish]
                            .filter(
                              (v) =>
                                v &&
                                v.trim() !== "" &&
                                !/^[\u2014\u2013\-]+$/.test(v.trim()),
                            )
                            .join(" / ") || "Default"}
                          {l.sku ? (
                            <span className="text-on-surface-variant/70">
                              {" "}
                              · {l.sku}
                            </span>
                          ) : null}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <button
                            type="button"
                            className="w-7 h-7 rounded bg-surface-container-high text-sm disabled:opacity-40"
                            disabled={foreignCheckoutActive}
                            onClick={() => {
                              updateLineQuantity(l.variantId, l.quantity - 1);
                              refresh();
                            }}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="w-6 text-center text-xs font-bold tabular-nums">
                            {l.quantity}
                          </span>
                          <button
                            type="button"
                            className="w-7 h-7 rounded bg-surface-container-high text-sm disabled:opacity-40"
                            disabled={foreignCheckoutActive}
                            onClick={() => {
                              updateLineQuantity(l.variantId, l.quantity + 1);
                              refresh();
                            }}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="font-medium text-primary shrink-0 text-right">
                        {formatCheckoutMoney(
                          (() => {
                            const fromMedusa =
                              medusaPricePreview?.lineSubtotalsByVariantId[
                                l.variantId
                              ];
                            if (
                              useMedusaBagTotals &&
                              fromMedusa != null &&
                              Number.isFinite(fromMedusa)
                            ) {
                              return fromMedusa;
                            }
                            return l.price * l.quantity;
                          })(),
                          displayCurrency,
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-8 pt-6 border-t border-surface-container-high space-y-2">
              {useMedusaBagTotals && quoteReviewItems.length > 0 ? (
                <CheckoutChangeReviewCard
                  quoteReviewRequired={quoteReviewRequired}
                  quoteReviewAcknowledged={quoteReviewAcknowledged}
                  quoteReviewItems={quoteReviewItems}
                  onAcknowledge={() => {
                    acknowledgeQuoteReview();
                    setError(null);
                  }}
                />
              ) : null}
              {useMedusaBagTotals && medusaPricePreview ? (
                <AuthoritativeTotalPanel
                  displayCurrency={displayCurrency}
                  subtotal={medusaPricePreview.subtotal}
                  shippingTotal={medusaPricePreview.shippingTotal}
                  taxTotal={medusaPricePreview.taxTotal}
                  discountTotal={medusaPricePreview.discountTotal}
                  total={medusaPricePreview.total}
                />
              ) : medusaPriceStatus === "loading" && lines.length > 0 ? (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Subtotal</span>
                    <span className="text-on-surface-variant">
                      {formatCheckoutMoney(localSubtotal, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Shipping</span>
                    <span className="text-on-surface-variant italic">
                      Calculating...
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Tax</span>
                    <span className="text-on-surface-variant italic">
                      Calculating...
                    </span>
                  </div>
                  <div className="flex justify-between font-headline font-bold text-lg pt-3 mt-1 border-t border-outline-variant/20">
                    <span>You pay</span>
                    <span className="text-on-surface-variant italic text-base font-normal">
                      Calculating...
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant pt-1 leading-relaxed">
                    Getting your final total with shipping and taxes...
                  </p>
                </>
              ) : medusaPriceStatus === "error" && lines.length > 0 ? (
                <>
                  <div
                    className="rounded-md bg-amber-50 border border-amber-200 p-3 mb-2"
                    role="status"
                  >
                    <p className="text-xs text-amber-900">
                      We could not load confirmed pricing. The estimate below
                      does not include shipping. Your final total will be
                      confirmed when you continue to payment.
                    </p>
                    {medusaPreviewError ? (
                      <p className="font-mono text-[11px] text-amber-800 break-words mt-1 opacity-90">
                        {medusaPreviewError}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      Subtotal (estimate)
                    </span>
                    <span>
                      {formatCheckoutMoney(localSubtotal, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Shipping</span>
                    <span className="text-on-surface-variant italic text-xs">
                      Added at payment
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      VAT ({(phVatRate * 100).toFixed(0)}%)
                    </span>
                    <span>
                      {formatCheckoutMoney(localTax, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-headline font-bold text-lg pt-3 mt-1 border-t border-outline-variant/20">
                    <span>Estimated total</span>
                    <span>
                      {formatCheckoutMoney(localTotal, displayCurrency)}
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 pt-1 leading-relaxed">
                    Shipping will be added. Your final amount is confirmed
                    before payment.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      Subtotal (estimate)
                    </span>
                    <span>
                      {formatCheckoutMoney(localSubtotal, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">Shipping</span>
                    <span className="text-on-surface-variant italic text-xs">
                      Added at payment
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-on-surface-variant">
                      VAT ({(phVatRate * 100).toFixed(0)}%)
                    </span>
                    <span>
                      {formatCheckoutMoney(localTax, displayCurrency)}
                    </span>
                  </div>
                  <div className="flex justify-between font-headline font-bold text-lg pt-3 mt-1 border-t border-outline-variant/20">
                    <span>Estimated total</span>
                    <span>
                      {formatCheckoutMoney(localTotal, displayCurrency)}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant pt-1 leading-relaxed">
                    Shipping and final tax will be added. Your exact amount is
                    confirmed before you pay.
                  </p>
                </>
              )}
            </div>

            {error ? (
              <StaleSessionNotice
                message={error}
                onDismiss={() => {
                  setError(null);
                }}
              />
            ) : null}

            {pendingPayment && (
              <div
                className="mt-6 rounded-lg border border-green-200 bg-green-50 p-4 text-left"
                role="region"
                aria-label="Order ready for payment"
              >
                <p className="text-xs font-bold uppercase tracking-widest text-green-900 mb-1">
                  Ready to pay
                </p>
                <p className="font-headline font-bold text-xl text-on-surface mb-2">
                  {pendingPayment.currencyCode}{" "}
                  {pendingPayment.confirmedTotal.toLocaleString("en-PH", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                {pendingPayment.priceMismatch ? (
                  <div
                    className="rounded bg-amber-50 border border-amber-200 px-3 py-2 mb-3"
                    role="status"
                  >
                    <p className="text-xs text-amber-900">
                      The final amount differs from the earlier estimate because
                      shipping or taxes were updated. The amount shown above is
                      what you will pay.
                    </p>
                  </div>
                ) : null}
                <p className="text-sm text-on-surface-variant mb-3">
                  Open {pendingPayment.providerLabel} in a secure tab, complete
                  payment there, then return here to confirm the result if the
                  provider does not bring you back automatically. Save your
                  tracking link to follow your order status.
                </p>
                <p className="font-mono text-[11px] break-all text-on-surface-variant bg-surface-container-lowest rounded px-2 py-1.5 mb-3">
                  {pendingPayment.trackingPageUrl}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => void copyTrackingLink()}
                    className="flex-1 py-2.5 rounded border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:bg-surface-container transition-colors"
                  >
                    {copyDone ? "Copied" : "Copy tracking link"}
                  </button>
                  <button
                    type="button"
                    disabled={!pendingPayment.correlationId || loading}
                    onClick={() =>
                      void resumePendingHostedPayment(pendingPayment)
                    }
                    className="flex-1 py-2.5 rounded border border-primary text-primary text-xs font-bold uppercase tracking-widest hover:bg-primary hover:text-on-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    I completed payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingPayment(null);
                      setCopyDone(false);
                      setError(null);
                    }}
                    className="flex-1 py-2.5 rounded border border-outline-variant text-on-surface-variant text-xs font-bold uppercase tracking-widest hover:border-error hover:text-error transition-colors"
                  >
                    Start over
                  </button>
                </div>
                <p className="text-xs text-on-surface-variant mt-2">
                  Start over only if you are abandoning this checkout.
                </p>
              </div>
            )}

            {embeddedData &&
              embeddedData.provider === "PAYPAL" &&
              embeddedData.paypalOrderId &&
              paymentMethod === "PAYPAL" && (
                <div className="mt-6 rounded-lg border border-outline-variant/20 p-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">
                    Pay with PayPal
                  </p>
                  <p className="text-xs text-on-surface-variant mb-3 leading-relaxed">
                    Sign in to PayPal or pay as a guest in the secure area
                    below.
                  </p>
                  <PayPalEmbeddedCheckout
                    paypalOrderId={embeddedData.paypalOrderId}
                    onApprove={() => {
                      void completeEmbeddedPayment(embeddedData);
                    }}
                    onError={(msg) => setError(msg)}
                  />
                </div>
              )}

            {embeddedData &&
              embeddedData.provider === "XENDIT" &&
              embeddedData.xenditComponentsSdkKey &&
              paymentMethod === "XENDIT" && (
                <div className="mt-6 rounded-lg border border-outline-variant/20 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">
                    Choose a payment method
                  </p>
                  <XenditComponentsCheckout
                    componentsSdkKey={embeddedData.xenditComponentsSdkKey}
                    onComplete={() => {
                      void completeEmbeddedPayment(embeddedData);
                    }}
                    onError={(message) => setError(message)}
                  />
                </div>
              )}

            {/* Delivery instructions */}
            <div className="mt-6">
              <label
                htmlFor="delivery-instructions"
                className="mb-1 block text-xs font-bold uppercase tracking-wider text-on-surface-variant"
              >
                Special delivery instructions{" "}
                <span className="font-normal normal-case">(optional)</span>
              </label>
              <textarea
                id="delivery-instructions"
                value={deliveryInstructions}
                onChange={(e) => setDeliveryInstructions(e.target.value)}
                placeholder="e.g. Leave at guard house, call before delivery"
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded border border-outline-variant/40 bg-surface-container-low px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Terms and conditions */}
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/20 bg-surface-container-low/50 p-3 text-sm">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                data-testid="checkout-terms-checkbox"
              />
              <span className="text-on-surface-variant leading-snug">
                I agree to the{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Terms and Conditions
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Privacy Policy
                </a>
                .
              </span>
            </label>

            <button
              type="button"
              data-testid="checkout-submit-pay"
              disabled={
                !hydrated ||
                lines.length === 0 ||
                loading ||
                quoteReviewRequired ||
                medusaPriceStatus === "loading" ||
                Boolean(pendingPayment) ||
                Boolean(embeddedData) ||
                foreignCheckoutActive ||
                !termsAccepted
              }
              onClick={handlePay}
              className="w-full mt-6 py-4 bg-primary text-on-primary font-headline font-bold text-sm uppercase tracking-widest rounded hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading
                ? paymentMethod === "COD"
                  ? "Placing your order..."
                  : "Starting checkout..."
                : medusaPriceStatus === "loading"
                  ? "Calculating total..."
                  : quoteReviewRequired
                    ? "Review updated totals above"
                    : pendingPayment || embeddedData
                      ? "Next step above"
                      : paymentMethod === "COD"
                        ? useMedusaBagTotals && medusaPricePreview
                          ? `Place order - ${formatCheckoutMoney(medusaPricePreview.total, displayCurrency)} (pay on delivery)`
                          : "Place order (pay on delivery)"
                        : useMedusaBagTotals && medusaPricePreview
                          ? `Pay ${formatCheckoutMoney(medusaPricePreview.total, displayCurrency)}`
                          : "Continue to payment"}
            </button>

            {pendingPayment && (
              <button
                type="button"
                data-testid="checkout-continue-payment"
                onClick={continueToHostedCheckout}
                className="w-full mt-3 py-4 border-2 border-primary text-primary font-headline font-bold text-sm uppercase tracking-widest rounded hover:bg-primary hover:text-on-primary transition-all"
              >
                Continue to {pendingPayment.providerLabel}
              </button>
            )}

            <p className="text-xs text-on-surface-variant mt-4 text-center">
              {paymentMethod === "COD" && !embeddedData && !pendingPayment ? (
                <>
                  Choose cash on delivery on the left, then place your order
                  here. You can change quantities above.
                </>
              ) : (
                <>
                  Follow the prompts above after you continue. You can still
                  change quantities in your bag.
                </>
              )}
            </p>

            <CheckoutTrustBadges />
          </div>
        </div>
      </div>
    </main>
  );
}
