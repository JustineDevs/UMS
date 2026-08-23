"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { isLocalRecaptchaBypassEnabled } from "@/lib/recaptcha-enterprise";

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

type RecaptchaProvider = "enterprise" | "standard";

function recaptchaProvider(): RecaptchaProvider {
  return process.env.NEXT_PUBLIC_RECAPTCHA_PROVIDER?.trim().toLowerCase() === "standard"
    ? "standard"
    : "enterprise";
}

function isLocalBrowserHost(): boolean {
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function isLocalBrowserBypass(): boolean {
  // A loopback browser cannot be a production origin. Keep local QA from
  // loading a production site key even when `next start` sets NODE_ENV=production.
  return isLocalBrowserHost();
}

export async function getRecaptchaToken(action: string): Promise<string | null> {
  if (isLocalRecaptchaBypassEnabled() || isLocalBrowserBypass()) return "local-development-bypass";
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  if (!siteKey) return null;
  const provider = recaptchaProvider();
  const deadline = Date.now() + 5_000;
  while (!(provider === "enterprise" ? window.grecaptcha?.enterprise : window.grecaptcha) && Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  if (provider === "enterprise" && !window.grecaptcha?.enterprise) return null;
  if (provider === "standard" && !window.grecaptcha?.ready) return null;
  return new Promise((resolve) => {
    const api = provider === "enterprise" ? window.grecaptcha?.enterprise : window.grecaptcha;
    api?.ready?.(() => {
      try {
        const execution = provider === "enterprise"
          ? window.grecaptcha?.enterprise?.execute(siteKey, { action })
          : window.grecaptcha?.execute?.(siteKey, { action });
        if (!execution) {
          resolve(null);
          return;
        }
        void execution.then(resolve).catch(() => resolve(null));
      } catch {
        resolve(null);
      }
    });
  });
}

export function RecaptchaScript() {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  const [browserBypass, setBrowserBypass] = useState<boolean | null>(null);
  useEffect(() => {
    setBrowserBypass(isLocalBrowserHost());
  }, []);
  // Keep the server and hydration output identical; load the script only after
  // the browser hostname has been checked.
  const localBypass = isLocalRecaptchaBypassEnabled() || browserBypass !== false;
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
