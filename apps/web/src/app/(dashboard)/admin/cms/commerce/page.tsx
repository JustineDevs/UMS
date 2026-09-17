import { CmsPageFrame } from "@/components/admin-console";
import { AdminTechnicalDetails } from "@/components/AdminTechnicalDetails";
import { CmsCommerceSearch } from "@/components/cms/CmsCommerceSearch";
import { requireAnyPagePermission } from "@/lib/require-page-permission";

export default async function CmsCommercePage() {
  await requireAnyPagePermission(["content:read", "catalog:read"]);
  return (
    <CmsPageFrame
      title="Product lookup"
      subtitle="Search your live catalog to copy product IDs or web addresses into pages, banners, or campaigns. You are not changing products here, only looking them up."
    >
      <AdminTechnicalDetails className="mb-8 max-w-3xl">
        <p>
          Results come from the same live catalog as Products. Raw JSON is useful for developers who
          wire blocks or automations.
        </p>
      </AdminTechnicalDetails>
      <CmsCommerceSearch />
    </CmsPageFrame>
  );
}
