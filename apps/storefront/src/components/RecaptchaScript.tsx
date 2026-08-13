"use client";

import Script from "next/script";

/* eslint-disable no-unused-vars */
declare global {
  interface Window {
    grecaptcha?: {
      enterprise?: {
        ready(callback: () => void): void;
        execute(siteKey: string, options: { action: string }): Promise<string>;
      };
    };
  }
}
/* eslint-enable no-unused-vars */

export async function getRecaptchaToken(action: string): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || !window.grecaptcha?.enterprise) return null;
  return new Promise((resolve) => {
    window.grecaptcha?.enterprise?.ready(() => {
      void window.grecaptcha?.enterprise
        ?.execute(siteKey, { action })
        .then(resolve)
        .catch(() => resolve(null));
    });
  });
}

export function RecaptchaScript() {
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return null;
  return <Script src="https://www.recaptcha.net/recaptcha/enterprise.js" strategy="afterInteractive" />;
}
