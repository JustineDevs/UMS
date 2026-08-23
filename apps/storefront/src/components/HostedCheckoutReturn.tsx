"use client";

import Link from "next/link";
import { sanitizeSameOriginUrl, sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { useEffect, useState } from "react";
import { clearCart } from "@/lib/cart";
import {
  buildHostedReturnMissingCorrelationMessage,
  buildHostedReturnStatusMessage,
  checkoutReviewHref,
  PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY,
  type HostedReturnProvider,
  type HostedReturnStatus,
} from "@/lib/hosted-payment-return";

async function resolveCorrelationId(
  provider: HostedReturnProvider,
): Promise<string | undefined> {
  let id = sessionStorage
    .getItem(PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY)
    ?.trim();
  if (id) return id;
  const rec = await fetch(
    `/api/payments/checkout-intents/recover?provider=${encodeURIComponent(
      provider,
    )}`,
    { credentials: "include" },
  );
  const recJson = (await rec.json().catch(() => ({}))) as {
    found?: boolean;
    correlationId?: string;
  };
  if (
    rec.ok &&
    recJson.found === true &&
    typeof recJson.correlationId === "string"
  ) {
    id = recJson.correlationId;
    try {
      sessionStorage.setItem(PAYMENT_CHECKOUT_CORRELATION_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
    return id;
  }
  return undefined;
}

const POLL_MS = 2000;
const POLL_MAX = 20;

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
  useEffect(() => {
    let disposed = false;
    async function run(): Promise<void> {
      if (status === "cancel" || status === "failure") {
        setMessage(buildHostedReturnStatusMessage(provider, status));
        setFailed(true);
        return;
      }

      const correlationId = await resolveCorrelationId(provider);
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
        if (!confirmRes.ok) {
          setMessage("PayPal did not confirm this payment. Your bag is unchanged; return to checkout and try again.");
          setFailed(true);
          return;
        }
      }

      const finalizeOnce = await fetch(
        `/api/payments/checkout-intents/${encodeURIComponent(
          correlationId,
        )}/finalize`,
        { method: "POST", credentials: "include" },
      );
      const finalizeJson = (await finalizeOnce.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        redirectUrl?: string;
      };
      if (disposed) return;
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
        const st = await fetch(
          `/api/payments/checkout-intents/${encodeURIComponent(correlationId)}`,
          { credentials: "include" },
        );
        const stJson = (await st.json().catch(() => ({}))) as {
          status?: string;
          medusaOrderId?: string | null;
          trackingPageUrl?: string | null;
          staleReason?: string | null;
          lastError?: string | null;
        };
        if (disposed) return;
        if (
          st.ok &&
          stJson.status === "completed" &&
          typeof stJson.trackingPageUrl === "string" &&
          stJson.trackingPageUrl
        ) {
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
          st.ok &&
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
      }

      setMessage(
        finalizeJson.error ??
          "Your payment may still be processing. Open your account or order tracking in a few minutes.",
      );
      setFailed(true);
    }

    void run();
    return () => {
      disposed = true;
    };
  }, [provider, providerOrderId, status]);

  return (
    <main className="storefront-page-shell motion-surface max-w-lg mx-auto text-center py-16 px-4">
      <h1 className="font-headline text-2xl font-bold text-primary mb-4">
        {failed ? "Almost there" : "Processing your order"}
      </h1>
      <p className="text-sm text-on-surface-variant leading-relaxed">
        {message}
      </p>
      {failed ? (
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/checkout"
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
