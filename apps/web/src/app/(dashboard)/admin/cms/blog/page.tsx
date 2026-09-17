import { CmsPageFrame } from "@/components/admin-console";
import { CmsBlogManager } from "@/components/cms/CmsBlogManager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsBlogPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Blog"
      subtitle="Posts appear on your site under /blog. Create and manage drafts below."
    >
      <CmsBlogManager />
    </CmsPageFrame>
  );
}
