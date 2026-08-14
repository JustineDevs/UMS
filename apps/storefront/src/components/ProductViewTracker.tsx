"use client";

import { useEffect } from "react";
import { trackProductView } from "@/lib/analytics";

export function ProductViewTracker({
  slug,
  id,
}: {
  slug: string;
  id: string;
}) {
  useEffect(() => {
    trackProductView({ slug, id });
  }, [slug, id]);
  return null;
}
