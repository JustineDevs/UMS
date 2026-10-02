import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminPageShell,
} from "@/components/admin-console";
import { ProductEditorLoader } from "@/components/catalog/ProductEditorLoader";
import {
  fetchCatalogProductDetail,
} from "@/lib/catalog-product-service";
import { requirePagePermission } from "@/lib/require-page-permission";

export const dynamic = "force-dynamic";

export default async function CatalogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("catalog:write");
  const { id } = await params;
  const product = await fetchCatalogProductDetail(id);

  if (!product) {
    return (
      <AdminPageShell
        title="Product unavailable"
        subtitle="No product matches this id, or the commerce service is unavailable."
        breadcrumbs={
          <AdminBreadcrumbs
            items={[
              { label: "Dashboard", href: "/admin" },
              { label: "Products", href: "/admin/catalog" },
              { label: "Edit" },
            ]}
          />
        }
      >
        <Link href="/admin/catalog" className="text-sm font-semibold text-primary hover:underline">
          Back to products
        </Link>
      </AdminPageShell>
    );
  }

  return (
    <AdminPageShell
      hideHeader
      className="bg-surface-container-low/30"
    >
      <ProductEditorLoader mode="edit" product={product} />
    </AdminPageShell>
  );
}
