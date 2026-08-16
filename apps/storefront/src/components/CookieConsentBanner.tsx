"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_KEY,
  type AnalyticsConsentValue,
} from "@/lib/analytics-consent";
import {
  POLICY_AUDIT_EVENT,
  POLICY_EFFECTIVE_DATE,
  POLICY_VERSION,
} from "@/lib/policy-content";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(ANALYTICS_CONSENT_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try {
      localStorage.setItem(
        ANALYTICS_CONSENT_KEY,
        "accepted" satisfies AnalyticsConsentValue,
      );
    } catch {
      /* localStorage unavailable */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT));
      window.dispatchEvent(new CustomEvent(POLICY_AUDIT_EVENT, {
        detail: { choice: "accepted", policyVersion: POLICY_VERSION, effectiveDate: POLICY_EFFECTIVE_DATE },
      }));
    }
    setVisible(false);
  }

  function essentialOnly() {
    try {
      localStorage.setItem(
        ANALYTICS_CONSENT_KEY,
        "essential-only" satisfies AnalyticsConsentValue,
      );
    } catch {
      /* localStorage unavailable */
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT));
      window.dispatchEvent(new CustomEvent(POLICY_AUDIT_EVENT, {
        detail: { choice: "essential-only", policyVersion: POLICY_VERSION, effectiveDate: POLICY_EFFECTIVE_DATE },
      }));
    }
    setVisible(false);
    if (typeof window !== "undefined" && "gtag" in window) {
      (window as { gtag?: (..._args: unknown[]) => void }).gtag?.("consent", "update", {
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
