import type { WorkerDatabaseClient } from "./database.ts";

type ReconcileInputLine = { variantId: string; quantity: number };
type ReconcileRow = {
  variant_id: string;
  product_handle: string;
  product_title: string;
  product_thumbnail: string | null;
  variant_sku: string | null;
  product_metadata: Record<string, unknown> | null;
  currency_code: string | null;
  unit_price: string | number | null;
  available_quantity: string | number;
  allow_backorder: boolean;
};

function minorUnitDivisor(currencyCode: string): number {
  const code = currencyCode.trim().toUpperCase();
  if (["BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF"].includes(code)) return 1;
  if (["BHD", "JOD", "KWD", "OMR", "TND"].includes(code)) return 1_000;
  return 100;
}

function majorFromMinor(value: number, currencyCode: string): number {
  return Math.round((value / minorUnitDivisor(currencyCode)) * 1_000_000) / 1_000_000;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function metadataString(metadata: Record<string, unknown> | null, key: string): string {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseInput(value: unknown): ReconcileInputLine[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const lines = (value as { lines?: unknown }).lines;
  if (!Array.isArray(lines) || lines.length > 50) return null;
  const parsed: ReconcileInputLine[] = [];
  for (const line of lines) {
    if (!line || typeof line !== "object" || Array.isArray(line)) return null;
    const input = line as { variantId?: unknown; quantity?: unknown };
    if (typeof input.variantId !== "string" || input.variantId.trim().length === 0 || input.variantId.trim().length > 200 || typeof input.quantity !== "number" || !Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 999) return null;
    parsed.push({ variantId: input.variantId.trim(), quantity: input.quantity });
  }
  return parsed;
}

export async function handleCartReconcileRequest(request: Request, database: WorkerDatabaseClient): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  let body: unknown;
  try { body = await request.json(); } catch { return json(400, { error: "invalid_json" }); }
  const lines = parseInput(body);
  if (!lines) return json(400, { error: "invalid_cart_lines" });
  if (lines.length === 0) return json(200, { ok: true, reconciledAt: new Date().toISOString(), lines: [], currency: "PHP", cartTotal: 0 });

  const variantIds = [...new Set(lines.map((line) => line.variantId))];
  const result = await database.query<ReconcileRow>(
    `SELECT v.id AS variant_id, p.handle AS product_handle, p.title AS product_title,
            p.thumbnail AS product_thumbnail, v.sku AS variant_sku, p.metadata AS product_metadata,
            price_row.currency_code, price_row.amount AS unit_price,
            COALESCE((SELECT SUM(il.stocked_quantity - il.reserved_quantity)
              FROM public.product_variant_inventory_item pvi
              JOIN public.inventory_level il ON il.inventory_item_id = pvi.inventory_item_id AND il.deleted_at IS NULL
             WHERE pvi.variant_id = v.id AND pvi.deleted_at IS NULL), 0) AS available_quantity,
            v.allow_backorder
       FROM public.product_variant v
       JOIN public.product p ON p.id = v.product_id AND p.deleted_at IS NULL AND p.status = 'published'
       LEFT JOIN LATERAL (
         SELECT pr.currency_code, pr.amount
           FROM public.product_variant_price_set pvps
           JOIN public.price pr ON pr.price_set_id = pvps.price_set_id AND pr.deleted_at IS NULL
          WHERE pvps.variant_id = v.id AND pvps.deleted_at IS NULL
            AND (pr.min_quantity IS NULL OR pr.min_quantity <= 1)
            AND (pr.max_quantity IS NULL OR pr.max_quantity >= 1)
          ORDER BY CASE WHEN pr.currency_code = 'php' THEN 0 ELSE 1 END, pr.amount ASC, pr.currency_code
          LIMIT 1
       ) price_row ON true
      WHERE v.id = ANY($1::text[]) AND v.deleted_at IS NULL`,
    [variantIds],
  );
  const rowsByVariant = new Map(result.rows.map((row) => [row.variant_id, row]));
  const reconciled = lines.map((line) => {
    const row = rowsByVariant.get(line.variantId);
    if (!row || row.unit_price === null || !Number.isFinite(Number(row.unit_price))) return { variantId: line.variantId, status: "error" as const };
    const currencyCode = (row.currency_code ?? "php").toUpperCase();
    const availableQuantity = Math.max(0, Math.floor(Number(row.available_quantity)));
    const overLimit = !row.allow_backorder && line.quantity > availableQuantity;
    return {
      variantId: line.variantId,
      quantity: line.quantity,
      slug: row.product_handle,
      name: row.product_title,
      sku: row.variant_sku ?? line.variantId.slice(-8),
      type: metadataString(row.product_metadata, "type"),
      finish: metadataString(row.product_metadata, "finish"),
      price: majorFromMinor(Number(row.unit_price), currencyCode),
      currencyCode,
      ...(row.product_thumbnail ? { thumbnail: row.product_thumbnail } : {}),
      availableQuantity,
      status: overLimit ? ("over_limit" as const) : ("current" as const),
    };
  });
  if (reconciled.some((line) => line.status === "error")) return json(503, { error: "Catalog reconciliation is temporarily unavailable", lines: reconciled.map(({ variantId, status }) => ({ variantId, status })) });
  const successful = reconciled.filter((line): line is Exclude<(typeof reconciled)[number], { status: "error" }> => line.status !== "error");
  const currency = successful[0]?.currencyCode ?? "PHP";
  const cartTotal = successful.reduce((total, line) => total + line.price * line.quantity, 0);
  return json(200, { ok: true, reconciledAt: new Date().toISOString(), lines: successful, currency, cartTotal: Math.round(cartTotal * 1_000_000) / 1_000_000 });
}
