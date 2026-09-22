import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { withWorkerTransaction, type WorkerDatabaseClient } from "./database.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type CycleLine = { id: string; cycle_count_id: string; product_id: string; variant_id: string; expected_quantity: number; counted_quantity: number | null; created_at: string };
type CycleRow = Record<string, unknown> & { id: string; organization_id: string; revision: number; status: string; location_id: string; inventory_cycle_count_lines?: CycleLine[] };

function json(body: Record<string, unknown>, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function org(claims: WorkerAuthClaims): string | null {
  const value = claims.organization_id ?? claims.org_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function can(claims: WorkerAuthClaims, permission: "read" | "write"): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "owner" || claims.role === "admin" || permissions.some((p) => p === "*" || p === `inventory:${permission}`);
}
function actor(claims: WorkerAuthClaims): string {
  return (typeof claims.email === "string" && claims.email.trim().toLowerCase()) || claims.sub || "system";
}
function uuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
function key(request: Request): string | null {
  const value = request.headers.get("Idempotency-Key")?.trim();
  return value && value.length >= 8 && value.length <= 255 ? value : null;
}
function row(row: CycleRow): Record<string, unknown> {
  return { ...row, inventory_cycle_count_lines: row.inventory_cycle_count_lines ?? [] };
}
async function claimsFor(request: Request, env: Env): Promise<WorkerAuthClaims | Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  return claims ?? json({ error: "unauthorized" }, 401);
}
async function body(request: Request, maxBytes: number): Promise<Record<string, unknown> | Response> {
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) return json({ error: "payload_too_large" }, 413);
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "invalid_json" }, 400);
    return value as Record<string, unknown>;
  } catch { return json({ error: "invalid_json" }, 400); }
}
function createInput(value: Record<string, unknown>): { locationId: string; lines: Array<{ productId: string; variantId: string }> } | null {
  if (Object.keys(value).some((k) => !["locationId", "lines"].includes(k))) return null;
  const locationId = typeof value.locationId === "string" ? value.locationId.trim() : "";
  const lines = value.lines;
  if (!locationId || locationId.length > 200 || !Array.isArray(lines) || lines.length < 1 || lines.length > 500) return null;
  const parsed: Array<{ productId: string; variantId: string }> = [];
  const variants = new Set<string>();
  for (const item of lines) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const line = item as Record<string, unknown>;
    if (Object.keys(line).some((k) => !["productId", "variantId"].includes(k))) return null;
    const productId = typeof line.productId === "string" ? line.productId.trim() : "";
    const variantId = typeof line.variantId === "string" ? line.variantId.trim() : "";
    if (!productId || productId.length > 200 || !variantId || variantId.length > 200 || variants.has(variantId)) return null;
    variants.add(variantId); parsed.push({ productId, variantId });
  }
  return { locationId, lines: parsed };
}
function mutationInput(value: Record<string, unknown>): { action: "record" | "complete" | "cancel"; expectedRevision: number; lines: Array<{ lineId: string; countedQuantity: number }> } | null {
  if (Object.keys(value).some((k) => !["action", "expectedRevision", "lines"].includes(k))) return null;
  const action = value.action;
  const expectedRevision = value.expectedRevision;
  if (!(action === "record" || action === "complete" || action === "cancel") || !Number.isSafeInteger(expectedRevision) || Number(expectedRevision) < 1) return null;
  if (value.lines !== undefined && (!Array.isArray(value.lines) || value.lines.length > 500)) return null;
  const lines: Array<{ lineId: string; countedQuantity: number }> = [];
  const seen = new Set<string>();
  for (const item of (Array.isArray(value.lines) ? value.lines : [])) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const line = item as Record<string, unknown>;
    const lineId = typeof line.lineId === "string" ? line.lineId.trim() : "";
    const countedQuantity = line.countedQuantity;
    if (!uuid(lineId) || !Number.isSafeInteger(countedQuantity) || Number(countedQuantity) < 0 || Number(countedQuantity) > 1_000_000 || seen.has(lineId)) return null;
    seen.add(lineId); lines.push({ lineId, countedQuantity: Number(countedQuantity) });
  }
  if (action === "record" && lines.length === 0) return null;
  if (action !== "record" && lines.length > 0) return null;
  return { action, expectedRevision: Number(expectedRevision), lines };
}
async function loadCount(database: WorkerDatabaseClient, organizationId: string, id?: string, limit = 50): Promise<CycleRow[]> {
  const result = id
    ? await database.query<CycleRow>(`SELECT c.*, COALESCE((SELECT json_agg(l ORDER BY l.created_at) FROM public.inventory_cycle_count_lines l WHERE l.cycle_count_id=c.id), '[]'::json) AS inventory_cycle_count_lines FROM public.inventory_cycle_counts c WHERE c.organization_id=$1 AND c.id=$2 LIMIT 1`, [organizationId, id])
    : await database.query<CycleRow>(`SELECT c.*, COALESCE((SELECT json_agg(l ORDER BY l.created_at) FROM public.inventory_cycle_count_lines l WHERE l.cycle_count_id=c.id), '[]'::json) AS inventory_cycle_count_lines FROM public.inventory_cycle_counts c WHERE c.organization_id=$1 ORDER BY c.created_at DESC LIMIT $2`, [organizationId, limit]);
  return result.rows.map((item) => ({ ...item, inventory_cycle_count_lines: Array.isArray(item.inventory_cycle_count_lines) ? item.inventory_cycle_count_lines : [] }));
}
async function audit(database: WorkerDatabaseClient, action: string, resourceId: string, organizationId: string, subject: string, details: Record<string, unknown>): Promise<void> {
  await database.query("INSERT INTO public.audit_logs (action,resource,details) VALUES ($1,$2,$3::jsonb)", [action, `inventory_cycle_count:${resourceId}`, JSON.stringify({ organization_id: organizationId, actor_subject: subject, ...details })]);
}

export async function handleInventoryCycleCountCollectionRequest(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient | undefined, env: Env): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const authenticated = await claimsFor(request, env); if (authenticated instanceof Response) return authenticated;
  const organizationId = org(authenticated); if (!organizationId) return json({ error: "organization_scope_required" }, 403);
  if (request.method === "GET") {
    if (!can(authenticated, "read")) return json({ error: "forbidden" }, 403);
    const requested = Number(new URL(request.url).searchParams.get("limit") ?? "50");
    const limit = Number.isSafeInteger(requested) && requested > 0 ? Math.min(200, requested) : 50;
    return json({ data: await loadCount(app, organizationId, undefined, limit), organizationId });
  }
  if (!can(authenticated, "write")) return json({ error: "forbidden" }, 403);
  if (!commerce) return json({ error: "commerce_database_unavailable" }, 503);
  const idempotencyKey = key(request); if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const inputValue = await body(request, 128 * 1024); if (inputValue instanceof Response) return inputValue;
  const input = createInput(inputValue); if (!input) return json({ error: "invalid_cycle_count_payload" }, 400);
  const requestHash = await hash({ organizationId, ...input });
  const scopedKey = await hash(`inventory-cycle-count:create:${organizationId}:${idempotencyKey}`);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(app), scopedKey, requestHash, async () => {
    const expected: Array<{ productId: string; variantId: string; expectedQuantity: number }> = [];
    for (const line of input.lines) {
      const stock = await commerce.query<{ stocked_quantity: number | string }>(`SELECT il.stocked_quantity FROM public.product_variant_inventory_item pvi JOIN public.product_variant v ON v.id=pvi.variant_id AND v.deleted_at IS NULL JOIN public.product p ON p.id=v.product_id AND p.deleted_at IS NULL JOIN public.inventory_level il ON il.inventory_item_id=pvi.inventory_item_id AND il.location_id=$3 AND il.deleted_at IS NULL WHERE v.id=$1 AND v.product_id=$2 AND p.metadata->>'organization_id'=$4 LIMIT 1`, [line.variantId, line.productId, input.locationId, organizationId]);
      if (!stock.rows[0]) return json({ error: "inventory_variant_not_found" }, 404);
      expected.push({ ...line, expectedQuantity: Number(stock.rows[0].stocked_quantity) });
    }
    const created = await withWorkerTransaction(app, async (transaction) => {
      const inserted = await transaction.query<CycleRow>(`INSERT INTO public.inventory_cycle_counts (organization_id,location_id,idempotency_key,created_by_email) VALUES ($1,$2,$3,$4) RETURNING *`, [organizationId, input.locationId, idempotencyKey, actor(authenticated)]);
      const count = inserted.rows[0]; if (!count) throw new Error("cycle_count_create_failed");
      for (const line of expected) await transaction.query(`INSERT INTO public.inventory_cycle_count_lines (cycle_count_id,product_id,variant_id,expected_quantity) VALUES ($1,$2,$3,$4)`, [count.id, line.productId, line.variantId, line.expectedQuantity]);
      await audit(transaction, "inventory.cycle_count.create", count.id, organizationId, authenticated.sub ?? actor(authenticated), { lines: expected.length });
      const loaded = await loadCount(transaction, organizationId, count.id); return loaded[0];
    });
    return json({ data: row(created) }, 201);
  })).response;
}

export async function handleInventoryCycleCountMutationRequest(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient | undefined, env: Env, id: string): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!uuid(id)) return json({ error: "invalid_cycle_count_id" }, 400);
  const authenticated = await claimsFor(request, env); if (authenticated instanceof Response) return authenticated;
  const organizationId = org(authenticated); if (!organizationId) return json({ error: "organization_scope_required" }, 403);
  if (!can(authenticated, "write")) return json({ error: "forbidden" }, 403);
  const idempotencyKey = key(request); if (!idempotencyKey) return json({ error: "idempotency_key_required" }, 400);
  const inputValue = await body(request, 64 * 1024); if (inputValue instanceof Response) return inputValue;
  const input = mutationInput(inputValue); if (!input) return json({ error: "invalid_cycle_count_operation" }, 400);
  const requestHash = await hash({ organizationId, id, ...input });
  const scopedKey = await hash(`inventory-cycle-count:${organizationId}:${id}:${input.action}:${idempotencyKey}`);
  return (await executeIdempotently(new HyperdriveIdempotencyStore(app), scopedKey, requestHash, async () => {
    const loaded = await loadCount(app, organizationId, id); const count = loaded[0];
    if (!count) return json({ error: "cycle_count_not_found" }, 404);
    if (count.revision !== input.expectedRevision) return json({ error: "cycle_count_conflict", code: "INVENTORY_CYCLE_COUNT_CONFLICT" }, 409);
    const lines = count.inventory_cycle_count_lines ?? [];
    if (input.action === "cancel") {
      if (count.status !== "open") return json({ error: "cycle_count_invalid_state", code: "INVENTORY_CYCLE_COUNT_INVALID_STATE" }, 409);
      const updated = await withWorkerTransaction(app, async (transaction) => {
        const result = await transaction.query<CycleRow>(`UPDATE public.inventory_cycle_counts SET status='cancelled',revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND revision=$3 RETURNING *`, [id, organizationId, input.expectedRevision]);
        if (!result.rows[0]) throw new Error("cycle_count_conflict");
        await audit(transaction, "inventory.cycle_count.cancel", id, organizationId, authenticated.sub ?? actor(authenticated), {});
        const loadedAfter = await loadCount(transaction, organizationId, id); return loadedAfter[0];
      });
      return json({ data: row(updated) });
    }
    if (input.action === "record") {
      if (count.status !== "open" || input.lines.some((line) => !lines.some((existing) => existing.id === line.lineId))) return json({ error: "cycle_count_invalid_state", code: "INVENTORY_CYCLE_COUNT_LINE_INVALID" }, 409);
      const updated = await withWorkerTransaction(app, async (transaction) => {
        for (const line of input.lines) {
          const result = await transaction.query(`UPDATE public.inventory_cycle_count_lines SET counted_quantity=$1 WHERE id=$2 AND cycle_count_id=$3`, [line.countedQuantity, line.lineId, id]);
          if (!result.rowCount) throw new Error("cycle_count_line_conflict");
        }
        const result = await transaction.query<CycleRow>(`UPDATE public.inventory_cycle_counts SET revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND revision=$3 RETURNING *`, [id, organizationId, input.expectedRevision]);
        if (!result.rows[0]) throw new Error("cycle_count_conflict");
        await audit(transaction, "inventory.cycle_count.record", id, organizationId, authenticated.sub ?? actor(authenticated), { lines: input.lines.length });
        const loadedAfter = await loadCount(transaction, organizationId, id); return loadedAfter[0];
      });
      return json({ data: row(updated) });
    }
    if (count.status !== "open" || lines.length === 0 || lines.some((line) => line.counted_quantity == null)) return json({ error: "cycle_count_incomplete", code: "INVENTORY_CYCLE_COUNT_INCOMPLETE" }, 400);
    if (!commerce) return json({ error: "commerce_database_unavailable" }, 503);
    await withWorkerTransaction(app, async (transaction) => {
      const marked = await transaction.query(`UPDATE public.inventory_cycle_counts SET status='processing',revision=revision+1,updated_at=now() WHERE id=$1 AND organization_id=$2 AND revision=$3`, [id, organizationId, input.expectedRevision]);
      if (!marked.rowCount) throw new Error("cycle_count_conflict");
    });
    try {
      await withWorkerTransaction(commerce, async (transaction) => {
        for (const line of lines) {
          const current = await transaction.query<{ inventory_item_id: string; stocked_quantity: number | string; reserved_quantity: number | string }>(`SELECT pvi.inventory_item_id,il.stocked_quantity,il.reserved_quantity FROM public.product_variant_inventory_item pvi JOIN public.product_variant v ON v.id=pvi.variant_id AND v.deleted_at IS NULL JOIN public.product p ON p.id=v.product_id AND p.deleted_at IS NULL JOIN public.inventory_level il ON il.inventory_item_id=pvi.inventory_item_id AND il.location_id=$2 AND il.deleted_at IS NULL WHERE v.id=$1 AND p.metadata->>'organization_id'=$3 FOR UPDATE`, [line.variant_id, count.location_id, organizationId]);
          const stock = current.rows[0]; if (!stock || Number(stock.stocked_quantity) !== Number(line.expected_quantity)) throw new Error("cycle_count_stale");
          const next = Number(line.counted_quantity); if (!Number.isSafeInteger(next) || next < Number(stock.reserved_quantity)) throw new Error("stock_below_reserved");
          await transaction.query(`UPDATE public.inventory_level SET stocked_quantity=$1,updated_at=now() WHERE inventory_item_id=$2 AND location_id=$3`, [next, stock.inventory_item_id, count.location_id]);
        }
      });
    } catch (error) {
      const code = error instanceof Error && error.message === "cycle_count_stale" ? "INVENTORY_CYCLE_COUNT_STALE" : "INVENTORY_WRITE_FAILED";
      await app.query(`UPDATE public.inventory_cycle_counts SET status='failed',failure_code=$1,failure_message=$2,revision=revision+1,updated_at=now() WHERE id=$3 AND organization_id=$4 AND status='processing'`, [code, "Unable to apply cycle count inventory", id, organizationId]);
      return json({ error: "Unable to apply cycle count inventory", code }, 409);
    }
    const completed = await withWorkerTransaction(app, async (transaction) => {
      const result = await transaction.query<CycleRow>(`UPDATE public.inventory_cycle_counts SET status='completed',revision=revision+1,completed_at=now(),updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='processing' RETURNING *`, [id, organizationId]);
      if (!result.rows[0]) throw new Error("cycle_count_finalize_failed");
      await audit(transaction, "inventory.cycle_count.complete", id, organizationId, authenticated.sub ?? actor(authenticated), { lines: lines.length });
      const loadedAfter = await loadCount(transaction, organizationId, id); return loadedAfter[0];
    });
    return json({ data: row(completed) });
  })).response;
}

export async function handleInventoryCycleCountDetailRequest(request: Request, app: WorkerDatabaseClient, env: Env, id: string): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  if (!uuid(id)) return json({ error: "invalid_cycle_count_id" }, 400);
  const authenticated = await claimsFor(request, env); if (authenticated instanceof Response) return authenticated;
  const organizationId = org(authenticated); if (!organizationId) return json({ error: "organization_scope_required" }, 403);
  if (!can(authenticated, "read")) return json({ error: "forbidden" }, 403);
  const loaded = await loadCount(app, organizationId, id); return loaded[0] ? json({ data: row(loaded[0]) }) : json({ error: "cycle_count_not_found" }, 404);
}
