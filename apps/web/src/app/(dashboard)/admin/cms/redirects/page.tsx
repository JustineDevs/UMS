import { CmsPageFrame } from "@/components/admin-console";
import { CmsRedirectsManager } from "@/components/cms/CmsRedirectsManager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsRedirectsPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Redirects"
      subtitle="Applied before a page loads on your public site. Paths should start with /."
    >
      <CmsRedirectsManager />
    </CmsPageFrame>
  );
}
