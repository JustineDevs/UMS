import { CmsBuilderPageClient } from "@/components/cms/CmsBuilderPageClient";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsBuilderPage() {
  await requirePagePermission("content:read");

  return <CmsBuilderPageClient />;
}
