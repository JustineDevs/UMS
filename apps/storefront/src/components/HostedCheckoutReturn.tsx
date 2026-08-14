"use client";

import Link from "next/link";
import { sanitizeTrustedPublicUrl } from "@universal-music-store/sdk";
import { useEffect, useRef, useState } from "react";
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
}: {
  provider: HostedReturnProvider;
  status: HostedReturnStatus;
}) {
  const [message, setMessage] = useState(
    "Payment received. Finalizing your order…",
  );
  const [failed, setFailed] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
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

      const finalizeOnce = await fetch(
        `/api/payments/checkout-intents/${encodeURIComponent(
          correlationId,
        )}/finalize`,
        { method: "POST", credentials: "include" },
      );
      const finalizeJson = (await finalizeOnce.json().catch(() => ({}))) as {
        error?: string;
        redirectUrl?: string;
      };
      if (cancelled.current) return;
      if (
        finalizeOnce.status === 409 &&
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
        window.location.href = safeRedirectUrl;
        return;
      }

      setMessage(
        "Confirming payment with our servers. You can leave this page; your order will update in your account.",
      );

      for (let i = 0; i < POLL_MAX; i += 1) {
        if (cancelled.current) return;
        await new Promise((resolve) => setTimeout(resolve, POLL_MS));
        const st = await fetch(
          `/api/payments/checkout-intents/${encodeURIComponent(correlationId)}`,
          { credentials: "include" },
        );
        const stJson = (await st.json().catch(() => ({}))) as {
          status?: string;
          medusaOrderId?: string | null;
          staleReason?: string | null;
          lastError?: string | null;
        };
        if (cancelled.current) return;
        if (
          st.ok &&
          stJson.status === "completed" &&
          typeof stJson.medusaOrderId === "string" &&
          stJson.medusaOrderId
        ) {
          window.location.href = `/track/${encodeURIComponent(
            stJson.medusaOrderId,
          )}`;
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
      cancelled.current = true;
    };
  }, [provider, status]);

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
