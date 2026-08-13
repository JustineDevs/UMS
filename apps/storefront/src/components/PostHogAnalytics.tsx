"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  ensurePostHogClient,
  identifyPostHogClient,
  resetPostHogClient,
} from "@universal-music-store/sdk";
import {
  ANALYTICS_CONSENT_EVENT,
  hasAnalyticsConsent,
} from "@/lib/analytics-consent";

function initPostHog(): void {
  ensurePostHogClient({
    tracingHeaders: ["localhost", "127.0.0.1"],
  });
}

function teardownPostHog(): void {
  resetPostHogClient();
}

export function PostHogAnalytics(): null {
  const { data: session } = useSession();
  const [consent, setConsent] = useState<boolean>(false);

  useEffect(() => {
    setConsent(hasAnalyticsConsent());
    const syncConsent = () => setConsent(hasAnalyticsConsent());
    window.addEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
    window.addEventListener("storage", syncConsent);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, syncConsent);
      window.removeEventListener("storage", syncConsent);
    };
  }, []);

  useEffect(() => {
    if (consent) {
      initPostHog();
    } else {
      teardownPostHog();
    }
  }, [consent]);

  useEffect(() => {
    if (!consent) {
      return;
    }
    if (!session?.user) {
      teardownPostHog();
      return;
    }
    initPostHog();
    const distinctId =
      session.user.id?.trim() ||
      session.user.email?.trim().toLowerCase() ||
      session.user.name?.trim() ||
      null;
    if (!distinctId) return;
    identifyPostHogClient(distinctId, {
      id: session.user.id?.trim() ?? null,
      email: session.user.email?.trim().toLowerCase() ?? null,
      name: session.user.name?.trim() ?? null,
      role: "customer",
    });
  }, [consent, session]);

  return null;
}
