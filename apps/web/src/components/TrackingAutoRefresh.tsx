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

  return <p className="mt-1 text-xs text-on-surface-variant">Updates automatically every minute while this page is open.</p>;
}
