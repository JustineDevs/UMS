import type { WorkerDatabaseClient } from "./database.ts";
import { addCartLine } from "./cart.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";
import { finalizeNativeOrderAcrossDatabases } from "./order-finalization.ts";

type Env = {
  JWT_SECRET?: string;
  SUPABASE_URL?: string;
  DEFAULT_ORGANIZATION_ID?: string;
  POS_SALE_REQUIRES_OPEN_SHIFT?: string;
};
type PosLine = { variantId: string; quantity: number };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function safePosError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (["insufficient_stock", "invalid_cart_quantity", "cart_or_variant_not_found", "variant_price_unavailable"].includes(message)) return message;
  if (message.startsWith("pos_policy_denied:")) return message;
  return fallback;
}
function canUsePos(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "admin" || claims.role === "owner" || permissions.includes("*") || permissions.includes("pos:use");
}
function organization(claims: WorkerAuthClaims): string | null {
  return typeof claims.organization_id === "string" && claims.organization_id.trim() ? claims.organization_id.trim() : null;
}
function parseLines(value: unknown): PosLine[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const lines = value.map((line) => {
    if (!line || typeof line !== "object" || Array.isArray(line)) return null;
    const row = line as Record<string, unknown>;
    const variantId = typeof row.variantId === "string" ? row.variantId.trim() : "";
    const quantity = typeof row.quantity === "number" && Number.isSafeInteger(row.quantity) ? row.quantity : 0;
    return variantId && quantity > 0 && quantity <= 100 ? { variantId, quantity } : null;
  });
  return lines.every((line): line is PosLine => Boolean(line)) ? lines as PosLine[] : null;
}
async function digest(raw: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, "0")).join("");
}
async function createCart(database: WorkerDatabaseClient, lines: PosLine[], email: string | null, metadata: Record<string, unknown>): Promise<string> {
  const cartId = `cart_${crypto.randomUUID()}`;
  await database.query("INSERT INTO public.cart (id,currency_code,email,metadata,created_at,updated_at) VALUES ($1,'php',$2,$3::jsonb,now(),now())", [cartId, email, JSON.stringify(metadata)]);
  try {
    for (const line of lines) await addCartLine(cartId, line.variantId, line.quantity, database);
    return cartId;
  } catch (error) {
    await database.query("UPDATE public.cart SET deleted_at=now(),updated_at=now() WHERE id=$1", [cartId]);
    throw error;
  }
}

async function assertPosControls(
  app: WorkerDatabaseClient,
  body: Record<string, unknown>,
  organizationId: string,
  env: Env,
): Promise<{ shiftId: string | null; terminalId: string | null; paymentMethod: "cash" | "card" | "wallet"; paymentReference: string | null }> {
  const shiftId = typeof body.shiftId === "string" && body.shiftId.trim() ? body.shiftId.trim() : null;
  const terminalId = typeof body.paymentTerminalId === "string" && body.paymentTerminalId.trim() ? body.paymentTerminalId.trim() : null;
  const paymentMethod = body.paymentMethod === "card" || body.paymentMethod === "wallet" ? body.paymentMethod : "cash";
  const paymentReference = typeof body.paymentReference === "string" && body.paymentReference.trim() ? body.paymentReference.trim().slice(0, 160) : null;

  if (paymentMethod !== "cash" && !terminalId && !paymentReference) {
    throw new Error("pos_policy_denied:payment_reference_or_certified_terminal_required");
  }
  if (terminalId) {
    const terminal = await app.query<{ id: string }>(
      `SELECT id
       FROM public.pos_payment_terminals
       WHERE id::text = $1 AND organization_id = $2 AND status = 'certified'
       LIMIT 1`,
      [terminalId, organizationId],
    );
    if (!terminal.rows[0]) throw new Error("pos_policy_denied:payment_terminal_not_certified");
  }
  if (shiftId) {
    const shift = await app.query<{ id: string }>(
      `SELECT id
       FROM public.pos_shifts
       WHERE id::text = $1 AND organization_id = $2 AND status = 'open'
       LIMIT 1`,
      [shiftId, organizationId],
    );
    if (!shift.rows[0] && env.POS_SALE_REQUIRES_OPEN_SHIFT === "true") {
      throw new Error("pos_policy_denied:open_shift_required");
    }
  } else if (env.POS_SALE_REQUIRES_OPEN_SHIFT === "true") {
    throw new Error("pos_policy_denied:shift_id_required");
  }
  return { shiftId, terminalId, paymentMethod, paymentReference };
}

async function claimOfflineSale(
  app: WorkerDatabaseClient,
  organizationId: string,
  idempotencyKey: string,
  offlineSaleId: string | null,
): Promise<{ status: "claimed" | "pending" | "committed"; orderId: string | null; orderNumber: string | null }> {
  const existing = await app.query<{ status: "pending" | "committed"; medusa_order_id: string | null; order_number: string | null }>(
    `SELECT status, medusa_order_id, order_number
     FROM public.pos_sale_commands
     WHERE organization_id = $1 AND (idempotency_key = $2 OR ($3 IS NOT NULL AND offline_sale_id = $3))
     ORDER BY created_at DESC LIMIT 1`,
    [organizationId, idempotencyKey, offlineSaleId],
  );
  if (existing.rows[0]) return { status: existing.rows[0].status, orderId: existing.rows[0].medusa_order_id, orderNumber: existing.rows[0].order_number };
  try {
    await app.query(
      `INSERT INTO public.pos_sale_commands (organization_id,idempotency_key,offline_sale_id,status)
       VALUES ($1,$2,$3,'pending')`,
      [organizationId, idempotencyKey, offlineSaleId],
    );
    return { status: "claimed", orderId: null, orderNumber: null };
  } catch (error) {
    if (!(error instanceof Error) || !/duplicate|unique|23505/i.test(error.message)) throw error;
    const raced = await app.query<{ status: "pending" | "committed"; medusa_order_id: string | null; order_number: string | null }>(
      `SELECT status, medusa_order_id, order_number
       FROM public.pos_sale_commands
       WHERE organization_id = $1 AND (idempotency_key = $2 OR ($3 IS NOT NULL AND offline_sale_id = $3))
       ORDER BY created_at DESC LIMIT 1`,
      [organizationId, idempotencyKey, offlineSaleId],
    );
    const row = raced.rows[0];
    return row ? { status: row.status, orderId: row.medusa_order_id, orderNumber: row.order_number } : { status: "pending", orderId: null, orderNumber: null };
  }
}

async function completeOfflineSale(app: WorkerDatabaseClient, organizationId: string, idempotencyKey: string, orderId: string, orderNumber: string): Promise<void> {
  await app.query(
    `UPDATE public.pos_sale_commands
     SET status='committed', medusa_order_id=$3, order_number=$4, completed_at=now()
     WHERE organization_id=$1 AND idempotency_key=$2`,
    [organizationId, idempotencyKey, orderId, orderNumber],
  );
}

async function releaseOfflineSaleClaim(app: WorkerDatabaseClient, organizationId: string, idempotencyKey: string): Promise<void> {
  await app.query(
    `DELETE FROM public.pos_sale_commands
     WHERE organization_id=$1 AND idempotency_key=$2 AND status='pending'`,
    [organizationId, idempotencyKey],
  );
}

export async function handlePosDraftRequest(request: Request, commerce: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !canUsePos(claims)) return json({ error: "unauthorized" }, 401);
  const org = organization(claims);
  if (!org) return json({ error: "organization_scope_required", code: "ORGANIZATION_SCOPE_REQUIRED" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "invalid_pos_payload" }, 400);
  const body = value as Record<string, unknown>;
  const lines = parseLines(body.items);
  if (!lines) return json({ error: "invalid_items" }, 400);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(commerce), key, await digest(raw), async () => {
    try {
      const cartId = await createCart(commerce, lines, email, { source: "worker-pos", organization_id: org, pos_features: body.posFeatures ?? {} });
      return json({ draftOrderId: cartId, displayId: cartId }, 201);
    } catch (error) {
      return json({ error: safePosError(error, "pos_draft_failed") }, 422);
    }
  });
  return result.response;
}

export async function handlePosSaleRequest(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !canUsePos(claims)) return json({ error: "unauthorized" }, 401);
  const org = organization(claims);
  if (!org) return json({ error: "organization_scope_required", code: "ORGANIZATION_SCOPE_REQUIRED" }, 403);
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key) return json({ error: "idempotency_key_required" }, 400);
  const raw = await request.text();
  let value: unknown; try { value = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  if (!value || typeof value !== "object" || Array.isArray(value)) return json({ error: "invalid_pos_payload" }, 400);
  const body = value as Record<string, unknown>;
  const lines = parseLines(body.items);
  if (!lines) return json({ error: "invalid_items" }, 400);
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(app), key, await digest(raw), async () => {
    const correlationId = crypto.randomUUID();
    let cartId: string | null = null;
    try {
      const controls = await assertPosControls(app, body, org, env);
      const offlineSaleId = typeof body.offlineSaleId === "string" && body.offlineSaleId.trim() ? body.offlineSaleId.trim().slice(0, 160) : null;
      const command = await claimOfflineSale(app, org, key, offlineSaleId);
      if (command.status === "committed" && command.orderId && command.orderNumber) {
        return json({ orderNumber: command.orderNumber, orderId: command.orderId, idempotent: true });
      }
      if (command.status === "pending") return json({ error: "pos_sale_in_progress", code: "CONFLICT" }, 409);
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
      cartId = await createCart(commerce, lines, email, {
        source: "worker-pos",
        organization_id: org,
        pos_features: body.posFeatures ?? {},
        pos_idempotency_key: key,
        ...(offlineSaleId ? { pos_offline_id: offlineSaleId } : {}),
        ...(controls.shiftId ? { pos_shift_id: controls.shiftId } : {}),
        ...(controls.terminalId ? { pos_payment_terminal_id: controls.terminalId } : {}),
        pos_payment_method: controls.paymentMethod,
        ...(controls.paymentReference ? { pos_payment_reference: controls.paymentReference } : {}),
      });
      const provider = controls.paymentMethod === "cash" ? "cod" : `pos_${controls.paymentMethod}`;
      const paymentStatus = controls.paymentMethod === "cash" ? "initiated" : "paid";
      const checkoutState = controls.paymentMethod === "cash" ? "awaiting_provider" : "provider_verified";
      await app.query(`INSERT INTO public.payment_attempts (organization_id,correlation_id,cart_id,provider,amount_minor,currency,status,checkout_state,idempotency_key) SELECT $1,$2::uuid,$3,$4,SUM(i.quantity * i.unit_price),'php',$5,$6,$7 FROM public.cart_line_item i WHERE i.cart_id=$3 AND i.deleted_at IS NULL`, [org, correlationId, cartId, provider, paymentStatus, checkoutState, key]);
      const finalized = await finalizeNativeOrderAcrossDatabases(app, commerce, correlationId, org);
      const order = await commerce.query<{ display_id: string | number; total: string | number }>("SELECT display_id,total FROM public.order WHERE id=$1", [finalized.orderId]);
      const orderNumber = String(order.rows[0]?.display_id ?? finalized.orderId);
      await app.query(`INSERT INTO public.pos_sale_ledger (organization_id,order_id,order_number,shift_id,terminal_id,total_minor,payment_method,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (organization_id,idempotency_key) DO NOTHING`, [org, finalized.orderId, orderNumber, controls.shiftId, controls.terminalId, Math.round(Number(order.rows[0]?.total ?? 0)), controls.paymentMethod, key]);
      await completeOfflineSale(app, org, key, finalized.orderId, orderNumber);
      return json({ orderNumber, orderId: finalized.orderId, idempotent: finalized.replayed }, finalized.replayed ? 200 : 201);
    } catch (error) {
      if (cartId) await commerce.query("UPDATE public.cart SET deleted_at=now(),updated_at=now() WHERE id=$1 AND completed_at IS NULL", [cartId]).catch(() => undefined);
      await releaseOfflineSaleClaim(app, org, key).catch(() => undefined);
      return json({ error: safePosError(error, "pos_sale_failed") }, 422);
    }
  });
  return result.response;
}
