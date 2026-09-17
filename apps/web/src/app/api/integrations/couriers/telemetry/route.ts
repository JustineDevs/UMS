import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { validateGeoPoint } from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

const telemetrySchema = z.object({
  shipment_id: z.string().trim().min(1).max(160),
  courier_id: z.string().trim().min(1).max(160),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  speed_kph: z.number().finite().nonnegative().max(500).optional(),
  heading: z.number().finite().min(0).max(360).optional(),
  captured_at: z.string().datetime().optional(),
}).strict();

function signatureMatches(raw: string, timestamp: string, signature: string, secret: string): boolean {
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

export async function POST(req: NextRequest) {
  const cid = getCorrelationId(req);
  const secret = process.env.COURIER_TELEMETRY_SECRET?.trim() || process.env.CHANNEL_WEBHOOK_SECRET?.trim();
  const timestamp = req.headers.get("x-telemetry-timestamp")?.trim() ?? "";
  const signature = req.headers.get("x-telemetry-signature")?.trim() ?? "";
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();
  const tenantKey = req.headers.get("x-tenant-key")?.trim();
  if (!secret || !tenantKey || !idempotencyKey) return correlatedJson(cid, { error: "Invalid courier request" }, { status: 400 });
  if (idempotencyKey.length > 160) return correlatedJson(cid, { error: "Invalid courier request" }, { status: 400 });
  const raw = await req.text();
  if (!signatureMatches(raw, timestamp, signature, secret)) return correlatedJson(cid, { error: "Invalid courier request" }, { status: 401 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return correlatedJson(cid, { error: "Invalid courier request" }, { status: 400 }); }
  const parsed = telemetrySchema.safeParse(body);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid courier request" }, { status: 400 });
  const point = { latitude: parsed.data.latitude, longitude: parsed.data.longitude };
  validateGeoPoint(point);
  const sup = adminSupabaseOr503(cid); if ("response" in sup) return sup.response;
  const courierQuery = /^[0-9a-f-]{36}$/i.test(parsed.data.courier_id)
    ? sup.client.from("delivery_logistics_couriers").select("id").eq("id", parsed.data.courier_id).eq("tenant_key", tenantKey)
    : sup.client.from("delivery_logistics_couriers").select("id").eq("slug", parsed.data.courier_id).eq("tenant_key", tenantKey);
  const courier = await courierQuery.maybeSingle();
  if (!courier.data?.id) return correlatedJson(cid, { error: "Invalid courier request" }, { status: 404 });
  const result = await sup.client.from("delivery_logistics_telemetry").insert({
    tenant_key: tenantKey,
    shipment_id: parsed.data.shipment_id,
    courier_id: courier.data.id,
    latitude: point.latitude,
    longitude: point.longitude,
    speed_kph: parsed.data.speed_kph ?? null,
    heading: parsed.data.heading ?? null,
    captured_at: parsed.data.captured_at ?? new Date().toISOString(),
    idempotency_key: idempotencyKey,
  }).select("*").single();
  if (result.error) {
    if (/duplicate key/i.test(result.error.message)) return correlatedJson(cid, { error: "Duplicate telemetry event" }, { status: 409 });
    return correlatedJson(cid, { error: "Unable to record telemetry" }, { status: 503 });
  }
  return correlatedJson(cid, { data: result.data }, { status: 201 });
}
