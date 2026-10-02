"use client";

import { useEffect } from "react";
import { HttpErrorPage } from "@/components/HttpErrorPage";

/**
 * The error-code route sits outside the public route group, so it needs its
 * own recovery boundary instead of inheriting the storefront boundary.
 * Keep the rendered message generic: the route may receive provider or
 * server failures that must not be echoed to the browser.
 */
export default function ErrorCodeRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error-code-route]", error);
  }, [error]);

  return (
    <HttpErrorPage
      code={500}
      title="Unable to load this error page"
      description="We could not load the requested error details. You can try again or return to the shop."
      onRetry={reset}
      digest={error.digest}
    />
  );
}
