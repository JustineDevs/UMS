import type { WorkerAuthClaims } from "./auth.ts";
import { verifyWorkerBearerToken } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";

type InventoryAdminEnv = { JWT_SECRET?: string; SUPABASE_URL?: string };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function text(value: unknown, max = 200): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

function org(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function canWrite(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((p) => p === "*" || p === "inventory:write");
}

export async function handleInventoryAdjustmentRequest(
  request: Request,
  database: WorkerDatabaseClient,
  env: InventoryAdminEnv,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), {
    secret: env.JWT_SECRET,
    supabaseUrl: env.SUPABASE_URL,
  });
  if (!claims || !canWrite(claims)) return json({ error: "forbidden" }, 403);
  const organizationId = org(claims);
  if (!organizationId) return json({ error: "organization_scope_required" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);

  let input: Record<string, unknown>;
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "invalid_json" }, 400);
    input = value as Record<string, unknown>;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const variantId = text(input.variantId ?? input.variant_id);
  const productId = text(input.productId ?? input.product_id);
  const locationId = text(input.locationId ?? input.location_id);
  const reason = text(input.reason, 32) ?? "correction";
  const hasStocked = typeof input.stockedQuantity === "number";
  const hasDelta = typeof input.delta === "number";
  if (!variantId || !productId || hasStocked === hasDelta) return json({ error: "invalid_inventory_payload" }, 400);
  const requested = hasStocked ? input.stockedQuantity : input.delta;
  if (typeof requested !== "number" || !Number.isSafeInteger(requested)) return json({ error: "invalid_inventory_quantity" }, 400);
  const expected = input.expectedStockedQuantity;
  if (expected !== undefined && (!Number.isSafeInteger(expected) || Number(expected) < 0)) return json({ error: "invalid_expected_quantity" }, 400);

  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ organizationId, variantId, productId, locationId, requested, expected, reason })));
  const requestHash = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, requestHash, async () => {
    const product = await database.query<{ metadata: unknown }>("SELECT metadata FROM public.product WHERE id=$1 AND deleted_at IS NULL", [productId]);
    const metadata = product.rows[0]?.metadata;
    const owner = metadata && typeof metadata === "object" && !Array.isArray(metadata) && typeof (metadata as Record<string, unknown>).organization_id === "string"
      ? (metadata as Record<string, unknown>).organization_id
      : null;
    if (owner !== organizationId) return json({ error: "catalog_product_not_owned" }, 403);

    return withWorkerTransaction(database, async (transaction) => {
      const variant = await transaction.query<{ inventory_item_id: string }>(
        "SELECT inventory_item_id FROM public.product_variant_inventory_item WHERE variant_id=$1 AND deleted_at IS NULL LIMIT 1",
        [variantId],
      );
      const inventoryItemId = variant.rows[0]?.inventory_item_id;
      if (!inventoryItemId) return json({ error: "inventory_variant_not_found" }, 404);
      const locations = locationId
        ? await transaction.query<{ id: string }>("SELECT id FROM public.stock_location WHERE id=$1 AND deleted_at IS NULL", [locationId])
        : await transaction.query<{ id: string }>("SELECT id FROM public.stock_location WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1");
      const location = locations.rows[0]?.id;
      if (!location) return json({ error: "stock_location_not_found" }, 404);
      const level = await transaction.query<{ stocked_quantity: number | string; reserved_quantity: number | string }>(
        "SELECT stocked_quantity,reserved_quantity FROM public.inventory_level WHERE inventory_item_id=$1 AND location_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [inventoryItemId, location],
      );
      const current = Number(level.rows[0]?.stocked_quantity ?? 0);
      const reserved = Number(level.rows[0]?.reserved_quantity ?? 0);
      if (expected !== undefined && Number(expected) !== current) return json({ error: "inventory_changed", code: "INVENTORY_CONFLICT", current }, 409);
      const next = current + (hasDelta ? Number(requested) : Number(requested) - current);
      if (!Number.isSafeInteger(next) || next < reserved || next > 1_000_000) return json({ error: "stock_below_reserved_or_out_of_range" }, 409);
      await transaction.query(
      `INSERT INTO public.inventory_level (id,inventory_item_id,location_id,stocked_quantity,reserved_quantity,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,now(),now())
       ON CONFLICT (inventory_item_id,location_id) WHERE deleted_at IS NULL
       DO UPDATE SET stocked_quantity=EXCLUDED.stocked_quantity,updated_at=now()`,
      [crypto.randomUUID(), inventoryItemId, location, next, reserved],
      );
      return json({ data: { productId, variantId, locationId: location, stockedQuantity: next, availableQuantity: Math.max(0, next - reserved), delta: next - current, reason } });
    });
  })).response;
}
