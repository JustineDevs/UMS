import { CmsPageFrame } from "@/components/admin-console";
import { CmsExperimentsManager } from "@/components/cms/CmsExperimentsManager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsExperimentsPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="A/B experiments"
      subtitle="Visitors are assigned a variant at random and keep it for that browser session. Your storefront uses the assignment to show the matching experience."
    >
      <CmsExperimentsManager />
    </CmsPageFrame>
  );
}
