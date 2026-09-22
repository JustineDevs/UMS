import type { WorkerDatabaseClient } from "./database.ts";
import { addCartLine } from "./cart.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type Env = { JWT_SECRET?: string; SUPABASE_URL?: string };
type Line = { variantId: string; quantity: number };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" } });
}
function hasPermission(claims: WorkerAuthClaims): boolean {
  const permissions = Array.isArray(claims.permissions) ? claims.permissions : [];
  return claims.role === "admin" || claims.role === "owner" || permissions.includes("*") || permissions.includes("chat_orders:manage");
}
function orgId(claims: WorkerAuthClaims): string | null {
  return typeof claims.organization_id === "string" && claims.organization_id.trim() ? claims.organization_id.trim() : null;
}
async function authorize(request: Request, env: Env): Promise<{ org: string } | Response> {
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims || !hasPermission(claims)) return json({ error: "unauthorized" }, 401);
  const org = orgId(claims);
  return org ? { org } : json({ error: "organization_scope_required" }, 403);
}
function parseLines(value: unknown): Line[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 50) return null;
  const lines = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const row = entry as Record<string, unknown>;
    if (typeof row.variantId !== "string" || !row.variantId.trim() || !Number.isSafeInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 100) return null;
    return { variantId: row.variantId.trim(), quantity: Number(row.quantity) };
  });
  return lines.every((line): line is Line => line !== null) ? lines : null;
}
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  const raw = await request.text();
  if (raw.length > 24_000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
async function digest(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleChatOrderList(request: Request, app: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
  const auth = await authorize(request, env);
  if (auth instanceof Response) return auth;
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const result = await app.query(
    `SELECT id, source, status, phone, address, raw_text, commerce_cart_id,
            commerce_order_id, commerce_order_display_id, commerce_payment_status, payment_provider, payment_external_id,
            payment_status, created_at
     FROM public.chat_order_intake WHERE organization_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [auth.org, limit],
  );
  return json({ rows: result.rows });
}

export async function handleChatOrderIntake(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await authorize(request, env);
  if (auth instanceof Response) return auth;
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 200) return json({ error: "idempotency_key_required" }, 400);
  const body = await readBody(request);
  if (!body) return json({ error: "invalid_payload" }, 400);
  const items = parseLines(body.items);
  const source = typeof body.source === "string" ? body.source.trim().slice(0, 80) : "manual";
  if (!items || !source) return json({ error: "valid_source_and_items_required" }, 400);
  const rawText = typeof body.raw_text === "string" ? body.raw_text.trim().slice(0, 4000) : null;
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 64) : null;
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 1000) : null;
  const payloadHash = await digest({ source, rawText, phone, address, items });
  const prior = await app.query<{ id: string; commerce_cart_id: string | null; status: string; metadata: Record<string, unknown> | null }>(
    `SELECT id,commerce_cart_id,status,metadata FROM public.chat_order_intake WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1`, [auth.org, key],
  );
  if (prior.rows[0]) {
    if (prior.rows[0].metadata?.request_hash !== payloadHash) return json({ error: "idempotency_key_reused_with_different_payload" }, 409);
    if (prior.rows[0].status === "failed") return json({ error: "previous_intake_failed_submit_with_new_key", id: prior.rows[0].id }, 409);
    if (!prior.rows[0].commerce_cart_id) return json({ error: "intake_creation_in_progress_retry_later", id: prior.rows[0].id }, 409);
    return json({ id: prior.rows[0].id, draftOrderId: prior.rows[0].commerce_cart_id, status: prior.rows[0].status }, 200);
  }

  const ticketId = crypto.randomUUID();
  const cartId = `cart_${crypto.randomUUID()}`;
  const cartMetadata = JSON.stringify({ source: "chat-order-intake", organization_id: auth.org, chat_order_intake_id: ticketId });
  try {
    await app.query(
      `INSERT INTO public.chat_order_intake (id,organization_id,idempotency_key,source,raw_text,phone,address,items,status,metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'pending',$9::jsonb)`,
      [ticketId, auth.org, key, source, rawText, phone, address, JSON.stringify(items), JSON.stringify({ origin: "worker", commerce_cart_id: cartId, request_hash: payloadHash })],
    );
  } catch (error) {
    if (error instanceof Error && /unique|duplicate|23505/i.test(error.message)) {
      const replay = await app.query<{ id: string; commerce_cart_id: string | null; status: string; metadata: Record<string, unknown> | null }>(`SELECT id,commerce_cart_id,status,metadata FROM public.chat_order_intake WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1`, [auth.org, key]);
      if (replay.rows[0]) {
        if (replay.rows[0].metadata?.request_hash !== payloadHash) return json({ error: "idempotency_key_reused_with_different_payload" }, 409);
        if (replay.rows[0].commerce_cart_id) return json({ id: replay.rows[0].id, draftOrderId: replay.rows[0].commerce_cart_id, status: replay.rows[0].status }, 200);
      }
    }
    throw error;
  }
  try {
    await commerce.query("INSERT INTO public.cart (id,currency_code,metadata,created_at,updated_at) VALUES ($1,'php',$2::jsonb,now(),now())", [cartId, cartMetadata]);
    for (const line of items) await addCartLine(cartId, line.variantId, line.quantity, commerce);
    await app.query(`UPDATE public.chat_order_intake SET commerce_cart_id=$3,status='draft_created',updated_at=now() WHERE id=$1 AND organization_id=$2`, [ticketId, auth.org, cartId]);
    return json({ id: ticketId, draftOrderId: cartId, status: "draft_created" }, 201);
  } catch (error) {
    await commerce.query("UPDATE public.cart SET deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL", [cartId]).catch(() => undefined);
    await app.query(`UPDATE public.chat_order_intake SET status='failed',metadata=COALESCE(metadata,'{}'::jsonb)||jsonb_build_object('last_error','cart_creation_failed'),updated_at=now() WHERE id=$1 AND organization_id=$2`, [ticketId, auth.org]).catch(() => undefined);
    return json({ error: "chat_cart_creation_failed", id: ticketId }, 422);
  }
}

export async function handleChatOrderStatus(request: Request, app: WorkerDatabaseClient, commerce: WorkerDatabaseClient, env: Env, ticketId: string): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const auth = await authorize(request, env);
  if (auth instanceof Response) return auth;
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) return json({ error: "invalid_idempotency_key" }, 400);
  const body = await readBody(request);
  const next = body?.status;
  if (next !== "processing" && next !== "cancelled") return json({ error: "unsupported_transition", message: "Completion is derived from verified payment webhooks." }, 409);
  const scopedKey = "chat-status:" + await digest({ organizationId: auth.org, ticketId, idempotencyKey });
  const requestHash = await digest({ organizationId: auth.org, ticketId, method: request.method, body });
  const result = await executeIdempotently(new HyperdriveIdempotencyStore(app, 86_400), scopedKey, requestHash, async () => {
    const current = await app.query<{ status: string; commerce_cart_id: string | null }>(
      'SELECT status,commerce_cart_id FROM public.chat_order_intake WHERE id=$1 AND organization_id=$2 LIMIT 1', [ticketId, auth.org],
    );
    const row = current.rows[0];
    if (!row) return json({ error: "ticket_not_found" }, 404);
    if (row.status === next || (next === "cancelled" && row.status === "cancel_pending")) {
      if (next === "cancelled" && row.commerce_cart_id) {
        try {
          await commerce.query("UPDATE public.cart SET deleted_at=now(),updated_at=now() WHERE id=$1 AND completed_at IS NULL AND deleted_at IS NULL", [row.commerce_cart_id]);
          await app.query("UPDATE public.chat_order_intake SET status='cancelled',updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='cancel_pending'", [ticketId, auth.org]);
        } catch {
          return json({ error: "cancellation_pending_retry_required" }, 503);
        }
      }
      return json({ id: ticketId, status: next });
    }
    if (next === "processing") {
      if (!["pending", "draft_created", "failed"].includes(row.status)) return json({ error: "transition_conflict" }, 409);
      const updated = await app.query("UPDATE public.chat_order_intake SET status='processing',updated_at=now() WHERE id=$1 AND organization_id=$2 AND status=$3", [ticketId, auth.org, row.status]);
      return updated.rowCount === 1 ? json({ id: ticketId, status: "processing" }) : json({ error: "transition_conflict" }, 409);
    }
    if (row.status === "completed") return json({ error: "paid_ticket_cannot_be_cancelled" }, 409);
    const claimed = await app.query("UPDATE public.chat_order_intake SET status='cancel_pending',updated_at=now() WHERE id=$1 AND organization_id=$2 AND status=$3", [ticketId, auth.org, row.status]);
    if (claimed.rowCount !== 1) return json({ error: "transition_conflict" }, 409);
    try {
      if (row.commerce_cart_id) await commerce.query("UPDATE public.cart SET deleted_at=now(),updated_at=now() WHERE id=$1 AND completed_at IS NULL AND deleted_at IS NULL", [row.commerce_cart_id]);
      await app.query("UPDATE public.chat_order_intake SET status='cancelled',updated_at=now() WHERE id=$1 AND organization_id=$2 AND status='cancel_pending'", [ticketId, auth.org]);
      return json({ id: ticketId, status: "cancelled" });
    } catch {
      return json({ error: "cancellation_pending_retry_required" }, 503);
    }
  });
  return result.response;
}
