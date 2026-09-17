import { CmsPageFrame } from "@/components/admin-console";
import { CmsMediaManager } from "@/components/cms/CmsMediaManager";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsMediaPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Media"
      subtitle="Files upload to secure media storage. Copy URLs into pages or blocks."
    >
      <CmsMediaManager />
    </CmsPageFrame>
  );
}
