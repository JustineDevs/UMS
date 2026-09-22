import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminPageShell,
  AuditTimeline,
} from "@/components/admin-console";
import { ProductEditorLoader } from "@/components/catalog/ProductEditorLoader";
import { Button } from "@/components/ui/button";
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
      title="Edit product"
      subtitle={product.title}
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Products", href: "/admin/catalog" },
            { label: "Edit" },
          ]}
        />
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href="/admin/catalog">Back to products</Link>
          </Button>
        </div>
      }
      inspector={
        <AuditTimeline
          resourcePrefix={`product:${product.id}`}
          title="Changes to this product"
        />
      }
      inspectorCollapsible={{
        storageKey: `admin.inspector.catalog-product:${product.id}`,
        expandLabel: "Activity",
        collapseLabel: "Hide activity",
      }}
    >
      <ProductEditorLoader mode="edit" product={product} />
    </AdminPageShell>
  );
}
