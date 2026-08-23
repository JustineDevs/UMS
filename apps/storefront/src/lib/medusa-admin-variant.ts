import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";

export const MEDUSA_VARIANT_INVENTORY_FIELDS =
  "id,product_id,sku,manage_inventory,*inventory_items,*inventory_items.inventory,*inventory_items.inventory.location_levels";

/** Medusa exposes variant detail through the filtered collection endpoint. */
export async function fetchMedusaAdminVariant(
  variantId: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({
    id: variantId,
    limit: "1",
    fields: MEDUSA_VARIANT_INVENTORY_FIELDS,
  });
  const response = await medusaAdminFetch(`/admin/product-variants?${params}`, {
    method: "GET",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { variants?: unknown[] };
  const variant = payload.variants?.[0];
  return variant && typeof variant === "object"
    ? (variant as Record<string, unknown>)
    : null;
}
