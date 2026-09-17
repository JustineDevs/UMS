import { CmsPageFrame } from "@/components/admin-console";
import { CmsBlogEditor } from "@/components/cms/CmsBlogEditor";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CmsBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePagePermission("content:read");
  const { id } = await params;
  return (
    <CmsPageFrame title="Edit blog post" subtitle="Draft, schedule, SEO, and preview.">
      <CmsBlogEditor postId={id} />
    </CmsPageFrame>
  );
}
