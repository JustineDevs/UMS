import type { ReactNode } from "react";
import Script from "next/script";

/**
 * Vercel Web Analytics without the `@vercel/analytics` package (avoids lockfile / install drift).
 * Only runs on Vercel (`VERCEL=1`). Enable Web Analytics in the Vercel project dashboard.
 * @see https://vercel.com/docs/analytics
 */
export function VercelWebAnalytics(): ReactNode {
  if (process.env.VERCEL !== "1") {
    return null;
  }
  return (
    <>
      <Script
        id="vercel-analytics-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html:
            "window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};",
        }}
      />
      <Script
        src="/_vercel/insights/script.js"
        strategy="afterInteractive"
      />
    </>
  );
}
