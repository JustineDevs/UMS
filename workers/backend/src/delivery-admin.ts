import type { WorkerDatabaseClient } from "./database.ts";
import { verifyWorkerBearerToken, type WorkerAuthClaims } from "./auth.ts";
import { executeIdempotently, HyperdriveIdempotencyStore } from "./idempotency.ts";

type DeliveryAdminEnv = { CMS_ADMIN_JWT_SECRET?: string; SUPABASE_URL?: string };
function json(body: Record<string, unknown>, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }); }
function organization(claims: WorkerAuthClaims): string | null { const value = claims.organization_id ?? claims.org_id; return typeof value === "string" && value.trim() ? value.trim() : null; }
function allowed(claims: WorkerAuthClaims, permission: string): boolean { const permissions = Array.isArray(claims.permissions) ? claims.permissions : []; return claims.role === "owner" || claims.role === "admin" || permissions.some((value) => value === "*" || value === permission); }
function limit(value: string | null): number { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : 50; }

export async function handleDeliveryShipmentsRequest(request: Request, database: WorkerDatabaseClient, env: DeliveryAdminEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const claims = await verifyWorkerBearerToken(request.headers.get("Authorization"), { secret: env.CMS_ADMIN_JWT_SECRET, supabaseUrl: env.SUPABASE_URL });
  if (!claims) return json({ error: "unauthorized" }, 401);
  if (!allowed(claims, request.method === "POST" ? "orders:write" : "dashboard:read")) return json({ error: "forbidden" }, 403);
  const org = organization(claims);
  if (!org) return json({ error: "organization_claim_required" }, 403);
  if (request.method === "POST") return handleMutation(request, database, org, claims);
  const params = new URL(request.url).searchParams;
  const values: unknown[] = [org];
  const clauses = ["organization_id = $1"];
  if (params.get("status")) { const status = params.get("status")!.trim(); if (!/^[a-z_]{1,32}$/.test(status)) return json({ error: "invalid_status" }, 400); values.push(status); clauses.push(`status = $${values.length}`); }
  values.push(limit(params.get("limit")));
  const shipments = await database.query(`SELECT * FROM public.delivery_logistics_shipments WHERE ${clauses.join(" AND ")} ORDER BY updated_at DESC LIMIT $${values.length}`, values);
  const events = await database.query(`SELECT * FROM public.delivery_logistics_events WHERE organization_id = $1 ORDER BY occurred_at DESC LIMIT $2`, [org, Math.min(limit(params.get("limit")), 100)]);
  return json({ data: { shipments: shipments.rows, events: events.rows } });
}

function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function safeStatus(value: unknown): string { return value === "assigned" || value === "in_transit" || value === "delivered" || value === "returned" || value === "cancelled" ? value : "planned"; }

async function handleMutation(request: Request, database: WorkerDatabaseClient, org: string, claims: WorkerAuthClaims): Promise<Response> {
  const key = request.headers.get("Idempotency-Key")?.trim();
  if (!key || key.length > 255) return json({ error: "idempotency_key_required" }, 400);
  let input: Record<string, unknown>;
  try { input = object(await request.json()); } catch { return json({ error: "invalid_json" }, 400); }
  const kind = text(input.kind);
  const hashBytes = new TextEncoder().encode(JSON.stringify({ org, kind, input }));
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", hashBytes))].map((value) => value.toString(16).padStart(2, "0")).join("");
  return (await executeIdempotently(new HyperdriveIdempotencyStore(database), key, hash, async () => {
    const actor = text(claims.email);
    if (kind === "shipment") {
      const orderId = text(input.order_id);
      const customerEmail = text(input.customer_email);
      if (!orderId || !customerEmail) return json({ error: "order_id_and_customer_email_required" }, 400);
      const result = await database.query(
        `INSERT INTO public.delivery_logistics_shipments
          (organization_id,order_id,order_display_id,customer_email,branch_id,courier_slug,courier_label,status,
           origin_address,destination_address,geocoded_destination,package_dimensions,hazard_flags,route_metadata,
           tracking_url,tracking_status,proof_of_delivery,cod_amount,driver_cash_balance,settlement_status,pricing,metadata,
           created_by_email,updated_by_email,medusa_fulfillment_id,provider_shipment_id,eta_at,idempotency_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,$17::jsonb,$18,$19,$20,$21::jsonb,$22::jsonb,$23,$23,$24,$25,$26,$27)
         ON CONFLICT (organization_id,order_id) DO UPDATE SET
           order_display_id=EXCLUDED.order_display_id, customer_email=EXCLUDED.customer_email, branch_id=EXCLUDED.branch_id,
           courier_slug=EXCLUDED.courier_slug, courier_label=EXCLUDED.courier_label, status=EXCLUDED.status,
           destination_address=EXCLUDED.destination_address, tracking_url=EXCLUDED.tracking_url, tracking_status=EXCLUDED.tracking_status,
           proof_of_delivery=EXCLUDED.proof_of_delivery, cod_amount=EXCLUDED.cod_amount, driver_cash_balance=EXCLUDED.driver_cash_balance,
           settlement_status=EXCLUDED.settlement_status, pricing=EXCLUDED.pricing, metadata=EXCLUDED.metadata,
           updated_by_email=EXCLUDED.updated_by_email, medusa_fulfillment_id=EXCLUDED.medusa_fulfillment_id,
           provider_shipment_id=EXCLUDED.provider_shipment_id, eta_at=EXCLUDED.eta_at, idempotency_key=EXCLUDED.idempotency_key, updated_at=now()
         WHERE delivery_logistics_shipments.organization_id = $1
         RETURNING *`,
        [org, orderId, text(input.order_display_id), customerEmail.toLowerCase(), text(input.branch_id), text(input.courier_slug), text(input.courier_label), safeStatus(input.status), JSON.stringify(object(input.origin_address)), JSON.stringify(object(input.destination_address)), JSON.stringify(object(input.geocoded_destination)), JSON.stringify(object(input.package_dimensions)), JSON.stringify(Array.isArray(input.hazard_flags) ? input.hazard_flags.map(String) : []), JSON.stringify(object(input.route_metadata)), text(input.tracking_url), text(input.tracking_status), JSON.stringify(object(input.proof_of_delivery)), typeof input.cod_amount === "number" ? input.cod_amount : null, typeof input.driver_cash_balance === "number" ? input.driver_cash_balance : null, ["held", "reconciled", "remitted", "none"].includes(input.settlement_status as string) ? input.settlement_status : "pending", JSON.stringify(object(input.pricing)), JSON.stringify(object(input.metadata)), actor, text(input.medusa_fulfillment_id), text(input.provider_shipment_id), text(input.eta_at), key],
      );
      return json({ data: result.rows[0] }, 201);
    }
    if (kind === "event") {
      const shipmentId = text(input.shipment_id);
      const eventType = text(input.event_type);
      if (!shipmentId || !eventType) return json({ error: "shipment_id_and_event_type_required" }, 400);
      const result = await database.query<{ append_delivery_logistics_event: Record<string, unknown> }>(
        `SELECT public.append_delivery_logistics_event($1,$2,$3,$4,$5::jsonb,$6::timestamptz,$7,$8) AS append_delivery_logistics_event`,
        [org, shipmentId, eventType, text(input.event_status), JSON.stringify(object(input.event_payload)), text(input.occurred_at) ?? new Date().toISOString(), actor, key],
      );
      return result.rows[0]?.append_delivery_logistics_event ? json({ data: result.rows[0].append_delivery_logistics_event }, 201) : json({ error: "delivery_event_failed" }, 502);
    }
    return json({ error: "kind_must_be_shipment_or_event" }, 400);
  })).response;
}
