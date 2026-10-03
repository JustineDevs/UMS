"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function TrackingAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [router]);

  return (
    <p className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-on-surface-variant" role="status" aria-live="polite">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
      Live status sync active
    </p>
  );
}
