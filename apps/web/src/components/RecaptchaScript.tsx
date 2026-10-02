"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  isLocalBrowserHost,
  recaptchaProvider,
} from "@/lib/recaptcha-client";
import { isLocalRecaptchaBypassEnabled } from "@/lib/recaptcha-enterprise";
import { useHydrated } from "@/lib/use-hydrated";

/* eslint-disable no-unused-vars */
declare global {
  interface Window {
    grecaptcha?: {
      ready?(callback: () => void): void;
      execute?(siteKey: string, options: { action: string }): Promise<string>;
      enterprise?: {
        ready(callback: () => void): void;
        execute(siteKey: string, options: { action: string }): Promise<string>;
      };
    };
  }
}
/* eslint-enable no-unused-vars */


export function RecaptchaScript() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  const hydrated = useHydrated();
  // Keep the server and hydration output identical; load the script only after
  // the browser hostname has been checked.
  const localBypass = isLocalRecaptchaBypassEnabled() || !hydrated || isLocalBrowserHost();
  useEffect(() => {
    if (!siteKey || localBypass) return;
    const markBadge = () => {
      const badge = document.querySelector<HTMLElement>(".grecaptcha-badge");
      if (!badge) return false;
      badge.setAttribute("role", "region");
      badge.setAttribute("aria-label", "Security verification");
      return true;
    };
    if (markBadge()) return;
    const observer = new MutationObserver(() => {
      if (markBadge()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [localBypass, siteKey]);
  if (!siteKey || localBypass) return null;
  const scriptName = recaptchaProvider() === "standard" ? "api.js" : "enterprise.js";
  return (
    <Script
      src={`https://www.google.com/recaptcha/${scriptName}?render=${encodeURIComponent(siteKey)}`}
      strategy="afterInteractive"
    />
  );
}
