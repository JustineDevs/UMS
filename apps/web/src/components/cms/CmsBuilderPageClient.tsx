"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const CmsPagesManager = dynamic(
  () => import("./CmsPagesManager").then((module) => module.CmsPagesManager),
  { ssr: false },
);

export function CmsBuilderPageClient({
  onClosePath = "/admin/cms/builder",
}: {
  onClosePath?: string;
}) {
  const router = useRouter();

  return (
    <CmsPagesManager
      startInBuilder
      onBuilderClose={() => router.push(onClosePath)}
    />
  );
}
