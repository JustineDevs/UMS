import { CmsPageFrame } from "@/components/admin-console";
import { CmsAnnouncementEditor } from "@/components/cms/CmsAnnouncementEditor";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsAnnouncementPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Announcement"
      subtitle="Shown above the storefront header when the body is non-empty and within the optional schedule window."
    >
      <CmsAnnouncementEditor />
    </CmsPageFrame>
  );
}
