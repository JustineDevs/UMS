"use client";

export const ANALYTICS_CONSENT_KEY = "universal-music-store-cookie-consent-v1";
export const ANALYTICS_CONSENT_EVENT = "ums-analytics-consent-changed";

export type AnalyticsConsentValue = "accepted" | "essential-only";

export function readAnalyticsConsent(): AnalyticsConsentValue | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return value === "accepted" || value === "essential-only" ? value : null;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent() === "accepted";
}
