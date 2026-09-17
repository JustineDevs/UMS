import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingClient } from "./onboarding-client";
import { buildPageMetadata, SEO_KEYWORDS } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Welcome",
  description: "Complete your onboarding details.",
  path: "/onboarding",
  keywords: [...SEO_KEYWORDS.utility],
  noindex: true,
});

export default function OnboardingPage() {
  return (
    <main className="storefront-page-shell mx-auto max-w-lg py-10">
      <Suspense fallback={<p className="text-sm text-on-surface-variant">Loading…</p>}>
        <OnboardingClient />
      </Suspense>
    </main>
  );
}
