"use client";

import { useEffect } from "react";
import { Button } from "@universal-music-store/ui";

export default function AdminDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin-dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="rounded-lg border border-error/20 bg-error-container/10 p-8 max-w-lg">
        <h2 className="text-lg font-semibold text-on-surface">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-on-surface-variant">
          {error.message || "An unexpected error occurred loading this page."}
        </p>
        <Button
          type="button"
          onClick={reset}
          className="mt-6 text-sm font-medium"
        >
          Try again
        </Button>
      </div>
    </div>
  );
}
