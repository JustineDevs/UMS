"use client";

import { useEffect } from "react";
import { capturePostHogClientException } from "@universal-music-store/sdk";
import "./globals.css";
import { HttpErrorPage } from "@/components/HttpErrorPage";
import { hasAnalyticsConsent } from "@/lib/analytics-consent";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (hasAnalyticsConsent()) {
      capturePostHogClientException(error, {
        scope: "storefront-global-error",
        digest: error.digest ?? null,
      });
    }
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-[100dvh] min-w-0 overflow-x-hidden bg-surface text-on-surface font-body antialiased supports-[height:100dvh]:min-h-dvh">
        <HttpErrorPage
          code={500}
          title="Something went wrong"
          description="A critical error occurred. Try again or return to the home page."
          onRetry={reset}
          digest={error.digest}
          compact
        />
      </body>
    </html>
  );
}
