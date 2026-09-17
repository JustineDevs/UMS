"use client";

import { useEffect } from "react";
import { capturePostHogClientException } from "@universal-music-store/sdk";
import { HttpErrorPage } from "@/components/HttpErrorPage";
import { hasAnalyticsConsent } from "@/lib/analytics-consent";

export default function PublicRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (hasAnalyticsConsent()) {
      capturePostHogClientException(error, {
        scope: "storefront-public-error",
        digest: error.digest ?? null,
      });
    }
    console.error(error);
  }, [error]);

  return (
    <HttpErrorPage
      code={500}
      title="Something went wrong"
      description="We could not load this page. You can try again or return to the shop."
      onRetry={reset}
      digest={error.digest}
    />
  );
}
