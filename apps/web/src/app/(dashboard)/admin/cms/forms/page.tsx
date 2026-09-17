import { CmsPageFrame } from "@/components/admin-console";
import { CmsFormsTable } from "@/components/cms/CmsFormsTable";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsFormsPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Form submissions"
      subtitle="Contact, newsletter, and lead forms on your public site send submissions here."
    >
      <CmsFormsTable />
    </CmsPageFrame>
  );
}
