import type { WorkerDatabaseClient } from "./database.ts";

type Env = { COURIER_TELEMETRY_SECRET?: string; CHANNEL_WEBHOOK_SECRET?: string };
const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function hexHmac(secret: string, value: string): Promise<string> { const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))), (v) => v.toString(16).padStart(2, "0")).join(""); }
function equal(a: string, b: string): boolean { if (a.length !== b.length) return false; let result = 0; for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i); return result === 0; }

export async function handleCourierTelemetryRequest(request: Request, database: WorkerDatabaseClient, env: Env): Promise<Response> {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const timestamp = request.headers.get("x-telemetry-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-telemetry-signature")?.trim().toLowerCase() ?? "";
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
  const tenantKey = request.headers.get("x-tenant-key")?.trim() ?? "";
  const secret = env.COURIER_TELEMETRY_SECRET?.trim() || env.CHANNEL_WEBHOOK_SECRET?.trim();
  if (!secret || !tenantKey || !idempotencyKey || idempotencyKey.length > 160 || !/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(signature) || Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return json({ error: "invalid_courier_request" }, 400);
  const raw = await request.text();
  if (!equal(await hexHmac(secret, `${timestamp}.${raw}`), signature)) return json({ error: "invalid_courier_request" }, 401);
  let input: Record<string, unknown>;
  try { const value = JSON.parse(raw) as unknown; if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); input = value as Record<string, unknown>; } catch { return json({ error: "invalid_courier_request" }, 400); }
  const shipmentId = typeof input.shipment_id === "string" ? input.shipment_id.trim() : "";
  const courierId = typeof input.courier_id === "string" ? input.courier_id.trim() : "";
  const latitude = typeof input.latitude === "number" ? input.latitude : NaN;
  const longitude = typeof input.longitude === "number" ? input.longitude : NaN;
  const speed = input.speed_kph == null ? null : typeof input.speed_kph === "number" ? input.speed_kph : NaN;
  const heading = input.heading == null ? null : typeof input.heading === "number" ? input.heading : NaN;
  const capturedAt = input.captured_at == null ? null : typeof input.captured_at === "string" && !Number.isNaN(Date.parse(input.captured_at)) ? input.captured_at : "invalid";
  if (!shipmentId || shipmentId.length > 160 || !courierId || courierId.length > 160 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || (speed !== null && (!Number.isFinite(speed) || speed < 0 || speed > 500)) || (heading !== null && (!Number.isFinite(heading) || heading < 0 || heading > 360)) || capturedAt === "invalid") return json({ error: "invalid_courier_request" }, 400);
  const courier = await database.query<{ id: string }>(/^[0-9a-f-]{36}$/i.test(courierId) ? "SELECT id FROM public.delivery_logistics_couriers WHERE id=$1 AND tenant_key=$2 LIMIT 1" : "SELECT id FROM public.delivery_logistics_couriers WHERE slug=$1 AND tenant_key=$2 LIMIT 1", [courierId, tenantKey]);
  if (!courier.rows[0]) return json({ error: "courier_not_found" }, 404);
  const inserted = await database.query<Record<string, unknown>>("INSERT INTO public.delivery_logistics_telemetry (tenant_key,shipment_id,courier_id,latitude,longitude,speed_kph,heading,captured_at,idempotency_key) VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8::timestamptz,now()),$9) ON CONFLICT (tenant_key,shipment_id,idempotency_key) DO NOTHING RETURNING id,tenant_key,shipment_id,courier_id,latitude,longitude,speed_kph,heading,captured_at,idempotency_key", [tenantKey, shipmentId, courier.rows[0].id, latitude, longitude, speed, heading, capturedAt, idempotencyKey]);
  if (!inserted.rows[0]) return json({ error: "duplicate_telemetry", code: "DUPLICATE_TELEMETRY" }, 409);
  return json({ data: inserted.rows[0] }, 201);
}
