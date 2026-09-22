import Link from "next/link";
import { AdminBreadcrumbs, AdminPageShell } from "@/components/admin-console";
import { AdminTechnicalDetails } from "@/components/AdminTechnicalDetails";
import { ProductEditorLoader } from "@/components/catalog/ProductEditorLoader";
import { getCatalogPriceCurrencyCode } from "@/lib/catalog-product-service";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CatalogNewPage() {
  await requirePagePermission("catalog:write");
  const regionCurrencyCode = await getCatalogPriceCurrencyCode();

  return (
    <AdminPageShell
      title="Add product"
      subtitle="Create a catalog item with one variant: choose Size and Color from presets or enter a custom label. You can edit details after save."
      breadcrumbs={
        <AdminBreadcrumbs
          items={[
            { label: "Dashboard", href: "/admin" },
            { label: "Products", href: "/admin/catalog" },
            { label: "New" },
          ]}
        />
      }
      actions={
        <Link
          href="/admin/catalog"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Back to products
        </Link>
      }
    >
      <AdminTechnicalDetails className="mb-8 max-w-2xl">
        <p>
          Data is saved to your online store. This form creates one variant and a price in your
          default region currency.
        </p>
      </AdminTechnicalDetails>
      <ProductEditorLoader mode="create" regionCurrencyCode={regionCurrencyCode} />
    </AdminPageShell>
  );
}
