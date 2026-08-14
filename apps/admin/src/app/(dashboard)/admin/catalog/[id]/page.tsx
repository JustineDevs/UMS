import Link from "next/link";
import {
  AdminBreadcrumbs,
  AdminPageShell,
  AuditTimeline,
} from "@/components/admin-console";
import { ProductEditorForm } from "@/components/catalog/ProductEditorForm";
import { Button } from "@/components/ui/button";
import {
  fetchCatalogProductDetail,
} from "@/lib/medusa-catalog-service";
import { getMedusaAdminProductEditUrl } from "@/lib/medusa-catalog-bridge";
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

  const medusaUrl = getMedusaAdminProductEditUrl(product.id);

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
          <Button asChild size="sm" variant="outline">
            <a href={medusaUrl} target="_blank" rel="noopener noreferrer">
              Open in store admin
            </a>
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
      <ProductEditorForm mode="edit" product={product} />
    </AdminPageShell>
  );
}
