import { CmsPageFrame } from "@/components/admin-console";
import { CmsSiteMapPanel } from "@/components/cms/CmsSiteMapPanel";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsSiteMapPage() {
  await requirePagePermission("content:read");

  return (
    <CmsPageFrame
      title="Content site map"
      subtitle="All CMS pages with breadcrumb parent checks and whether any header, mobile, or footer link targets /p/your-slug. Use this to find published pages that are hard to reach from the main navigation."
    >
      <CmsSiteMapPanel />
    </CmsPageFrame>
  );
}
