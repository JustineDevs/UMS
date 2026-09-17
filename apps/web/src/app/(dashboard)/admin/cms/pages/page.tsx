import { CmsPageFrame } from "@/components/admin-console";
import { CmsPagesManager } from "@/components/cms/CmsPagesManager";
import { requirePagePermission } from "@/lib/require-page-permission";
import { redirect } from "next/navigation";

export default async function CmsPagesAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  await requirePagePermission("content:read");
  const params = await searchParams;

  if (params.section === "home") {
    redirect("/admin/cms/builder");
  }

  return (
    <CmsPageFrame
      title="CMS pages"
      subtitle="Published pages appear on your site at /p/your-page-name. Use the editor for the page body and content blocks (hero, text, image, calls to action)."
      inspector={null}
      showSurfaceRail={false}
    >
      <CmsPagesManager />
    </CmsPageFrame>
  );
}
