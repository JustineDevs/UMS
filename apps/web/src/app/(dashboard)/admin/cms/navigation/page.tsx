import { CmsPageFrame } from "@/components/admin-console";
import { CmsNavigationEditor } from "@/components/cms/CmsNavigationEditor";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsNavigationPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Navigation"
      subtitle="Structured data for header links, footer columns, and social links. The editor checks format before saving."
    >
      <CmsNavigationEditor />
    </CmsPageFrame>
  );
}
