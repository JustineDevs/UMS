import { createHash } from "node:crypto";
import { medusaAdminFetch } from "@/lib/medusa-admin-http";
import { getMedusaAdminSdk } from "@/lib/medusa-pos";
import {
  stockedQuantityFromVariantRaw,
  availableQuantityFromVariantRaw,
} from "@/lib/inventory-quantity-utils";
export {
  stockedQuantityFromVariantRaw,
  availableQuantityFromVariantRaw,
} from "@/lib/inventory-quantity-utils";

async function fetchVariantById(
  variantId: string,
  fields: string,
): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ id: variantId, limit: "1", fields });
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

async function getStockLocationId(requested?: string): Promise<string | null> {
  try {
    const res = await medusaAdminFetch("/admin/stock-locations?limit=5");
    if (!res.ok) return null;
    const json = (await res.json()) as {
      stock_locations?: Array<{ id?: string }>;
    };
    const locations = json.stock_locations ?? [];
    const match = requested
      ? locations.find((location) => String(location.id ?? "") === requested)
      : locations[0];
    const id = match?.id;
    return id ? String(id) : null;
  } catch {
    return null;
  }
}

function extractInventoryItemId(
  variant: Record<string, unknown> | undefined,
): string | null {
  if (!variant) return null;
  const items = variant.inventory_items as unknown[] | undefined;
  if (!Array.isArray(items) || items.length === 0) return null;
  const first = items[0] as Record<string, unknown>;
  const invItem = first.inventory_item as Record<string, unknown> | undefined;
  if (invItem?.id != null) return String(invItem.id);
  if (first.inventory_item_id != null) return String(first.inventory_item_id);
  return null;
}

async function resolveInventoryItemIdFromVariant(
  variantId: string,
): Promise<string | null> {
  try {
    const fields =
      "id,*inventory_items,*inventory_items.inventory_item";
    return extractInventoryItemId(await fetchVariantById(variantId, fields) ?? undefined);
  } catch {
    return null;
  }
}

async function resolveInventoryItemIdFromProduct(
  productId: string,
  variantId: string,
): Promise<string | null> {
  try {
    const fieldsFull =
      "id,*variants,*variants.inventory_items,*variants.inventory_items.inventory_item";
    let res = await medusaAdminFetch(
      `/admin/products/${encodeURIComponent(productId)}?fields=${encodeURIComponent(fieldsFull)}`,
      { method: "GET" },
    );
    if (!res.ok) {
      const fieldsLite =
        "id,*variants,*variants.inventory_items.inventory_item_id";
      res = await medusaAdminFetch(
        `/admin/products/${encodeURIComponent(productId)}?fields=${encodeURIComponent(fieldsLite)}`,
        { method: "GET" },
      );
    }
    if (!res.ok) return null;
    const json = (await res.json()) as {
      product?: { variants?: Array<Record<string, unknown>> };
    };
    const variants = json.product?.variants ?? [];
    const variant = variants.find((x) => String(x.id) === variantId);
    return extractInventoryItemId(variant);
  } catch {
    return null;
  }
}

/** Medusa SKU length guard; full variant ids can exceed typical DB columns. */
const CATALOG_FALLBACK_SKU_MAX = 200;

/**
 * Stable catalog-only SKU when the variant has no merchant SKU.
 * Never use slice(-N) on the variant id: that truncates prefixes like `variant_` into `riant_`
 * and collides across variants, which breaks create + link and triggers false "already exists" paths.
 */
function generatedCatalogSku(variantId: string): string {
  const sanitized = variantId.replace(/[^a-zA-Z0-9_-]/g, "");
  const prefixed = `catalog-${sanitized}`;
  if (prefixed.length <= CATALOG_FALLBACK_SKU_MAX) return prefixed;
  const digest = createHash("sha256").update(variantId).digest("hex").slice(0, 24);
  return `catalog-${digest}`;
}

async function findInventoryItemIdBySku(sku: string): Promise<string | null> {
  try {
    const qs = new URLSearchParams();
    qs.set("sku", sku);
    qs.set("limit", "10");
    const res = await medusaAdminFetch(
      `/admin/inventory-items?${qs.toString()}`,
      { method: "GET" },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      inventory_items?: Array<{ id?: string; sku?: string | null }>;
    };
    const items = json.inventory_items ?? [];
    const exact = items.find((x) => String(x.sku ?? "") === sku);
    if (exact?.id) return String(exact.id);
    const first = items[0];
    return first?.id ? String(first.id) : null;
  } catch {
    return null;
  }
}

/**
 * Medusa v2: `POST /admin/inventory-items` creates a standalone inventory item (sku, etc.).
 * Linking it to a variant is a separate call — `variant_id` on the root create route is invalid (400).
 *
 * @see https://docs.medusajs.com/resources/references/types/interfaces/types.AdminCreateProductVariantInventoryItem
 */
async function requestCreateAndLinkInventoryItemForVariant(
  productId: string,
  variantId: string,
): Promise<string | null> {
  let sku = generatedCatalogSku(variantId);
  try {
    const variant = await fetchVariantById(variantId, "id,sku");
    const s = variant?.sku;
    if (typeof s === "string" && s.trim()) {
      sku = s.trim();
    }
  } catch {
    /* use generated sku */
  }

  const createRes = await medusaAdminFetch("/admin/inventory-items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku,
      requires_shipping: true,
    }),
  });

  let inventoryItemId: string | null = null;
  if (createRes.ok) {
    const created = (await createRes.json()) as {
      inventory_item?: { id?: string };
      inventory_items?: Array<{ id?: string }>;
    };
    const raw =
      created.inventory_item?.id ?? created.inventory_items?.[0]?.id ?? null;
    inventoryItemId = raw != null ? String(raw) : null;
  }

  if (!inventoryItemId) {
    inventoryItemId = await findInventoryItemIdBySku(sku);
  }

  if (!inventoryItemId) {
    return null;
  }

  const linkPath = `/admin/products/${encodeURIComponent(productId)}/variants/${encodeURIComponent(variantId)}/inventory-items`;
  let linkRes = await medusaAdminFetch(linkPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      inventory_item_id: inventoryItemId,
      variant_id: variantId,
      required_quantity: 1,
    }),
  });

  if (!linkRes.ok) {
    const batchPath = `/admin/products/${encodeURIComponent(productId)}/variants/inventory-items/batch`;
    linkRes = await medusaAdminFetch(batchPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        create: [
          {
            variant_id: variantId,
            inventory_item_id: inventoryItemId,
            required_quantity: 1,
          },
        ],
      }),
    });
  }

  if (!linkRes.ok) {
    return null;
  }

  return String(inventoryItemId);
}

async function inventoryLevelHttpErrorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const j = JSON.parse(text) as { message?: unknown };
    if (typeof j.message === "string" && j.message.trim()) {
      return j.message.trim();
    }
  } catch {
    /* ignore */
  }
  return text.trim() || `Inventory update failed (${res.status})`;
}

/**
 * HTTP fallback: Medusa v2 uses POST on the nested route to update an existing level,
 * and POST on the collection route to create one. Try update first, then create.
 */
async function setInventoryLevelViaHttp(
  inventoryItemId: string,
  locationId: string,
  qty: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const nestedPath = `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels/${encodeURIComponent(locationId)}`;
  let res = await medusaAdminFetch(nestedPath, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stocked_quantity: qty }),
  });
  if (res.ok) return { ok: true };

  res = await medusaAdminFetch(
    `/admin/inventory-items/${encodeURIComponent(inventoryItemId)}/location-levels`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id: locationId,
        stocked_quantity: qty,
      }),
    },
  );
  if (res.ok) return { ok: true };
  return { ok: false, message: await inventoryLevelHttpErrorMessage(res) };
}

const VARIANT_INVENTORY_ADMIN_FIELDS =
  "id,*inventory_items,*inventory_items.inventory,*inventory_items.inventory.location_levels,*inventory_items.inventory_item";

async function fetchProductVariantInventoryRaw(
  variantId: string,
): Promise<Record<string, unknown> | null> {
  try {
    return await fetchVariantById(variantId, VARIANT_INVENTORY_ADMIN_FIELDS);
  } catch {
    return null;
  }
}

/**
 * Available units for a single variant (stocked minus reserved).
 */
export async function fetchVariantAvailableQuantity(
  variantId: string,
): Promise<number | null> {
  const v = await fetchProductVariantInventoryRaw(variantId);
  if (!v) return null;
  return availableQuantityFromVariantRaw(v);
}

/**
 * Stocked units summed across levels (same basis as {@link applyVariantStockedQuantity}).
 */
export async function fetchVariantStockedQuantity(
  variantId: string,
  locationId?: string,
): Promise<number | null> {
  const v = await fetchProductVariantInventoryRaw(variantId);
  if (!v) return null;
  if (!locationId) return stockedQuantityFromVariantRaw(v);
  let stocked = 0;
  const inventoryItems = v.inventory_items as unknown[] | undefined;
  for (const item of inventoryItems ?? []) {
    const inventory = (item as Record<string, unknown>).inventory as
      | Record<string, unknown>
      | undefined;
    const levels = inventory?.location_levels as unknown[] | undefined;
    for (const level of levels ?? []) {
      const row = level as Record<string, unknown>;
      if (String(row.location_id ?? row.stock_location_id ?? "") === locationId) {
        stocked += Number(row.stocked_quantity ?? 0);
      }
    }
  }
  return stocked;
}

/**
 * Set stocked quantity at the default stock location for a variant.
 */
export async function applyVariantStockedQuantity(params: {
  productId: string;
  variantId: string;
  stockedQuantity: number;
  locationId?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const locationId = await getStockLocationId(params.locationId);
  if (!locationId) {
    return {
      ok: false,
      message:
        "No warehouse location is set up in the store yet. Add one in the full store admin, then try again.",
    };
  }

  const qty = Math.max(0, Math.floor(Number(params.stockedQuantity)));

  let inventoryItemId: string | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    inventoryItemId =
      (await resolveInventoryItemIdFromVariant(params.variantId)) ??
      (await resolveInventoryItemIdFromProduct(
        params.productId,
        params.variantId,
      ));
    if (inventoryItemId) break;
    await new Promise((r) => setTimeout(r, 500));
  }

  if (!inventoryItemId) {
    inventoryItemId = await requestCreateAndLinkInventoryItemForVariant(
      params.productId,
      params.variantId,
    );
  }

  if (!inventoryItemId) {
    return {
      ok: false,
      message:
        "Stock could not be attached to this size and color yet. Wait a moment and save again. If this continues, open the full store admin, turn on stock for this product, then save here once more.",
    };
  }

  const sdk = getMedusaAdminSdk();
  if (sdk) {
    try {
      await sdk.admin.inventoryItem.updateLevel(inventoryItemId, locationId, {
        stocked_quantity: qty,
      });
      return { ok: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const http = await setInventoryLevelViaHttp(
        inventoryItemId,
        locationId,
        qty,
      );
      if (http.ok) return http;
      return {
        ok: false,
        message: http.message || msg,
      };
    }
  }

  return setInventoryLevelViaHttp(inventoryItemId, locationId, qty);
}
