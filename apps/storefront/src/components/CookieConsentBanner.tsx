"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const CONSENT_KEY = "maharlika-cookie-consent-v1";

type ConsentValue = "accepted" | "essential-only";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted" satisfies ConsentValue);
    } catch {
      /* localStorage unavailable */
    }
    setVisible(false);
  }

  function essentialOnly() {
    try {
      localStorage.setItem(CONSENT_KEY, "essential-only" satisfies ConsentValue);
    } catch {
      /* localStorage unavailable */
    }
    setVisible(false);
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as { gtag?: (...args: unknown[]) => void }).gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
      });
    }
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/20 bg-surface px-4 py-4 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="flex-1 text-sm text-on-surface-variant leading-relaxed">
          We use cookies to improve your shopping experience and for analytics. By continuing, you agree
          to our{" "}
          <Link href="/privacy" className="text-primary underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/cookies" className="text-primary underline">
            Cookie Policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={essentialOnly}
            className="rounded border border-outline-variant px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={accept}
            className="rounded bg-primary px-4 py-2 text-xs font-bold uppercase tracking-wider text-on-primary hover:opacity-90 transition-opacity"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helper: check if user has given full analytics consent (call client-side). */
export function hasAnalyticsConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === "accepted";
  } catch {
    return false;
  }
}
