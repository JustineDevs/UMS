import { CmsPageFrame } from "@/components/admin-console";
import { CmsCategoryEditor } from "@/components/cms/CmsCategoryEditor";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsCategoriesPage() {
  await requirePagePermission("content:read");
  return (
    <CmsPageFrame
      title="Category storytelling"
      subtitle="Copy and blocks for filtered shop views. Match the category name used in the catalog."
    >
      <CmsCategoryEditor />
    </CmsPageFrame>
  );
}
