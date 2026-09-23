"use client";

import Link from "next/link";
import { sanitizeSameOriginUrl, sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clearCart } from "@/lib/cart";
import {
  buildHostedReturnMissingCorrelationMessage,
  buildHostedReturnStatusMessage,
  checkoutReviewHref,
  isUnresolvedHostedReturnToken,
  PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY,
  type HostedReturnProvider,
  type HostedReturnStatus,
} from "@/lib/hosted-payment-return";

async function resolveCorrelationId(
  provider: HostedReturnProvider,
  providerOrderId?: string,
): Promise<string | undefined> {
  const storedId = sessionStorage
    .getItem(PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY)
    ?.trim();
  const rec = await fetch(
    `/api/payments/checkout-intents/recover?provider=${encodeURIComponent(provider)}${
      providerOrderId ? `&provider_order_id=${encodeURIComponent(providerOrderId)}` : ""
    }`,
    { credentials: "include" },
  );
  if (!rec.ok) return storedId || undefined;
  const recJson = (await rec.json().catch(() => ({}))) as {
    found?: boolean;
    correlationId?: string;
  };
  if (
    recJson.found === true &&
    typeof recJson.correlationId === "string"
  ) {
    const id = recJson.correlationId;
    try {
      sessionStorage.setItem(PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  }
  return storedId || undefined;
}

// Provider webhooks can arrive after the hosted-return redirect. Keep the
// browser on the return page long enough to observe reconciliation without
// making the user restart a payment that is already settling.
const POLL_MS = 1000;
const POLL_MAX = 45;
const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export function HostedCheckoutReturn({
  provider,
  status,
  providerOrderId,
}: {
  provider: HostedReturnProvider;
  status: HostedReturnStatus;
  providerOrderId?: string;
}) {
  const hasFailedStatus = status === "cancel" || status === "failure";
  const [message, setMessage] = useState(() =>
    hasFailedStatus
      ? buildHostedReturnStatusMessage(provider, status)
      : "Payment received. Finalizing your order…",
  );
  const [failed, setFailed] = useState(hasFailedStatus);
  const recoveryLinkRef = useRef<HTMLAnchorElement>(null);
  useIsomorphicLayoutEffect(() => {
    if (!failed) return;
    let frame = 0;
    let retry = 0;
    const focusRecoveryLink = () => {
      recoveryLinkRef.current?.focus();
    };
    frame = window.requestAnimationFrame(() => {
      focusRecoveryLink();
      retry = window.setTimeout(focusRecoveryLink, 0);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
  }, [failed, provider, status]);
  useEffect(() => {
    let disposed = false;
    async function run(): Promise<void> {
      if (status === "cancel" || status === "failure") {
        setMessage(buildHostedReturnStatusMessage(provider, status));
        setFailed(true);
        return;
      }

      // Stripe can occasionally return the documented placeholder literally.
      // Do not trust that value as a provider identifier; recover only through
      // the same-site cart/attempt capability and let the Worker reconcile the
      // provider state before finalizing.
      const effectiveProviderOrderId = isUnresolvedHostedReturnToken(
        provider,
        providerOrderId,
      )
        ? undefined
        : providerOrderId;
      const correlationId = await resolveCorrelationId(
        provider,
        effectiveProviderOrderId,
      );
      if (disposed) return;
      if (!correlationId) {
        setMessage(buildHostedReturnMissingCorrelationMessage(provider));
        setFailed(true);
        return;
      }

      if (provider === "paypal" && providerOrderId) {
        const confirmRes = await fetch("/api/checkout/paypal/confirm", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ correlationId, orderId: providerOrderId }),
        });
        if (disposed) return;
        if (!confirmRes.ok) {
          setMessage("PayPal did not confirm this payment. Your bag is unchanged; return to checkout and try again.");
          setFailed(true);
          return;
        }
      }

      const finalize = () =>
        fetch(
          `/api/payments/checkout-intents/${encodeURIComponent(
            correlationId,
          )}/finalize`,
          { method: "POST", credentials: "include" },
        );
      const finalizeOnce = await finalize();
      if (disposed) return;
      const finalizeJson = finalizeOnce.ok
        ? ((await finalizeOnce.json().catch(() => ({}))) as {
            error?: string;
            code?: string;
            redirectUrl?: string;
          })
        : {};
      if (
        finalizeOnce.status === 409 &&
        finalizeJson.code !== "FINALIZE_IN_PROGRESS" &&
        typeof finalizeJson.error === "string" &&
        finalizeJson.error.trim()
      ) {
        window.location.href = checkoutReviewHref(finalizeJson.error.trim());
        return;
      }
      if (
        finalizeOnce.ok &&
        typeof finalizeJson.redirectUrl === "string" &&
        finalizeJson.redirectUrl.length > 0
      ) {
        const safeRedirectUrl = sanitizeTrustedPublicUrl(finalizeJson.redirectUrl);
        if (!safeRedirectUrl) {
          setMessage("Payment was confirmed, but the provider returned an invalid redirect. Check your order history.");
          return;
        }
        clearCart();
        window.location.href = safeRedirectUrl;
        return;
      }

      setMessage(
        "Confirming payment with our servers. You can leave this page; your order will update in your account.",
      );

      for (let i = 0; i < POLL_MAX; i += 1) {
        if (disposed) return;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        if (disposed) return;
        const st = await fetch(
          `/api/payments/checkout-intents/${encodeURIComponent(correlationId)}`,
          { credentials: "include" },
        );
        if (disposed) return;
        if (!st.ok) continue;
        const stJson = (await st.json().catch(() => ({}))) as {
          status?: string;
          checkoutState?: string;
          medusaOrderId?: string | null;
          trackingPageUrl?: string | null;
          staleReason?: string | null;
          lastError?: string | null;
        };
        const paymentSettled =
          ["paid", "completed", "captured"].includes(stJson.status ?? "") ||
          ["completed", "provider_verified", "finalizing", "awaiting_completion"].includes(
            stJson.checkoutState ?? "",
          );
        if (paymentSettled && typeof stJson.trackingPageUrl === "string" && stJson.trackingPageUrl) {
          const safeTrackingUrl = sanitizeSameOriginUrl(
            stJson.trackingPageUrl,
            window.location.origin,
          );
          if (!safeTrackingUrl) {
            setMessage("Your order is complete, but its tracking link is invalid. Check your account or confirmation email.");
            setFailed(true);
            return;
          }
          clearCart();
          window.location.href = safeTrackingUrl;
          return;
        }
        if (
          (stJson.status === "expired" || stJson.status === "needs_review") &&
          typeof (stJson.staleReason ?? stJson.lastError) === "string" &&
          (stJson.staleReason ?? stJson.lastError)!.trim().length > 0
        ) {
          window.location.href = checkoutReviewHref(
            (
              stJson.staleReason ??
              stJson.lastError ??
              "Review your updated total before paying again."
            ).trim(),
          );
          return;
        }
        if (paymentSettled) {
          const retryFinalize = await finalize();
          if (disposed) return;
          if (retryFinalize.ok) {
            const retryJson = (await retryFinalize.json().catch(() => ({}))) as {
              redirectUrl?: string;
            };
            if (typeof retryJson.redirectUrl === "string" && retryJson.redirectUrl) {
              const safeRedirectUrl = sanitizeTrustedPublicUrl(retryJson.redirectUrl);
              if (!safeRedirectUrl) {
                setMessage("Payment was confirmed, but the provider returned an invalid redirect. Check your order history.");
                setFailed(true);
                return;
              }
              clearCart();
              window.location.href = safeRedirectUrl;
              return;
            }
          }
        }
      }

      setMessage(
        finalizeJson.error ??
          "Your payment may still be processing. Open your account or order tracking in a few minutes.",
      );
      setFailed(true);
    }

    void run().catch(() => {
      if (disposed) return;
      setMessage(
        "We could not reach the payment service. Your bag is unchanged; return to checkout and try again.",
      );
      setFailed(true);
    });
    return () => {
      disposed = true;
    };
  }, [provider, providerOrderId, status]);

  return (
    <main className="storefront-page-shell motion-surface max-w-lg mx-auto text-center py-16 px-4">
      <h1 className="font-headline text-2xl font-bold text-primary mb-4">
        {failed ? "Almost there" : "Processing your order"}
      </h1>
      <p
        className="text-sm text-on-surface-variant leading-relaxed"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>
      {failed ? (
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/checkout"
            ref={recoveryLinkRef}
            data-testid="hosted-return-back-to-checkout"
            className="inline-flex items-center justify-center rounded bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:opacity-90"
          >
            Back to checkout
          </Link>
          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded border border-outline-variant px-6 py-3 text-sm font-medium text-primary hover:bg-surface-container-low"
          >
            My account
          </Link>
        </div>
      ) : null}
    </main>
  );
}
