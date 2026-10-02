import { AdminPageShell } from "@/components/admin-console";
import { ProductEditorLoader } from "@/components/catalog/ProductEditorLoader";
import { getCatalogPriceCurrencyCode } from "@/lib/catalog-product-service";
import { requirePagePermission } from "@/lib/require-page-permission";

export default async function CatalogNewPage() {
  await requirePagePermission("catalog:write");
  const regionCurrencyCode = await getCatalogPriceCurrencyCode();

  return (
    <AdminPageShell
      hideHeader
      className="bg-surface-container-low/30"
    >
      <ProductEditorLoader mode="create" regionCurrencyCode={regionCurrencyCode} />
    </AdminPageShell>
  );
}
