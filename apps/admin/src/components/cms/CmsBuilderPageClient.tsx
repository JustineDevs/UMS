"use client";

import { useRouter } from "next/navigation";
import { StorefrontHomeVisualEditor } from "./StorefrontHomeVisualEditor";

export function CmsBuilderPageClient({
  onClosePath = "/admin/cms/builder",
}: {
  onClosePath?: string;
}) {
  const router = useRouter();

  return (
    <StorefrontHomeVisualEditor
      onClose={() => router.push(onClosePath)}
    />
  );
}
