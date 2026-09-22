"use client";

import { useEffect } from "react";
import { HttpErrorPage } from "@/components/HttpErrorPage";

export default function E2eSignInError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[sign-in/e2e] route failure", error); }, [error]);
  return <HttpErrorPage code={500} title="Sign-in unavailable" description="The test sign-in route could not load. Retry or return to the standard sign-in page." onRetry={reset} digest={error.digest} />;
}
