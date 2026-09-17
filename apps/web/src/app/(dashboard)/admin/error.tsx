"use client";

import { useEffect } from "react";

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
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-primary px-6 py-2 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
