import { fetchWorkerInventoryPage } from "@/lib/worker-admin-bridge";

export type InventoryAdminRow = {
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  size: string;
  color: string;
  available: number;
};

export function aggregateStockAvailableByProductId(
  rows: InventoryAdminRow[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const id = row.productId?.trim();
    if (!id) continue;
    map.set(id, (map.get(id) ?? 0) + row.available);
  }
  return map;
}

export type InventoryAdminPageResult = {
  rows: InventoryAdminRow[];
  total: number;
  limit: number;
  offset: number;
};

/** Worker-native staff inventory read retained under its old source-compatible name. */
export async function fetchInventoryPage(opts: {
  limit: number;
  offset: number;
}): Promise<InventoryAdminPageResult> {
  const result = await fetchWorkerInventoryPage(opts);
  return { ...result, limit: opts.limit, offset: opts.offset };
}

export async function fetchAllInventoryRows(opts?: {
  batchSize?: number;
}): Promise<InventoryAdminRow[]> {
  const batch = opts?.batchSize ?? 100;
  const rows: InventoryAdminRow[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchInventoryPage({ limit: batch, offset });
    rows.push(...page.rows);
    if (page.rows.length === 0 || offset + page.rows.length >= page.total) break;
    offset += batch;
  }
  return rows;
}
