import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";
import { geocodeAddress, optimizeRouteWithProvider } from "@/lib/logistics-provider-client";
import { z } from "zod";
import { assertDeliveryGeofence, calculateDriverEarnings, verifyDeliveryProof } from "@universal-music-store/platform-data";
import { parseBoundedJson } from "@/lib/bounded-request-body";

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
const geoPointSchema = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) }).strict();
const baseSchema = { shipment_id: z.string().trim().min(1).max(160) };
const operationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("courier"), slug: z.string().trim().min(1).max(80), label: z.string().trim().min(1).max(160), phone: z.string().trim().max(40).optional(), status: z.enum(["available", "assigned", "offline", "suspended"]).optional(), latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional(), rating: z.number().finite().min(0).max(5).optional(), max_weight_kg: z.number().finite().nonnegative().max(10000).optional(), max_volume_cm3: z.number().finite().nonnegative().max(100000000).optional(), cash_limit: z.number().finite().nonnegative().max(100000000).optional(), metadata: z.record(z.string().max(80), z.unknown()).default({}) }).strict(),
  z.object({ kind: z.literal("telemetry"), ...baseSchema, courier_id: z.string().trim().max(160).optional(), latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180), speed_kph: z.number().finite().nonnegative().max(500).optional(), heading: z.number().finite().min(0).max(360).optional(), captured_at: z.string().datetime().optional() }).strict(),
  z.object({ kind: z.literal("proof"), ...baseSchema, method: z.enum(["signature", "photo", "otp", "contactless"]), recipient_name: z.string().trim().max(160).optional(), photo_url: z.string().url().max(2048).optional(), signature: z.string().max(100000).optional(), contact_log: z.string().trim().max(2000).optional(), otp_digest: z.string().max(256).optional(), otp: z.string().trim().max(32).optional(), expected_otp: z.string().trim().max(32).optional(), latitude: z.number().finite().min(-90).max(90).optional(), longitude: z.number().finite().min(-180).max(180).optional(), destination: geoPointSchema.optional(), verified: z.boolean().default(false) }).strict(),
  z.object({ kind: z.literal("exception"), ...baseSchema, exception_type: z.string().trim().min(1).max(80), severity: z.enum(["low", "medium", "high", "critical"]).optional(), details: z.string().trim().min(1).max(4000) }).strict(),
  z.object({ kind: z.literal("settlement"), ...baseSchema, courier_id: z.string().trim().max(160).optional(), delivery_fee: z.number().finite().nonnegative().max(100000000).default(0), driver_earnings: z.number().finite().nonnegative().max(100000000).default(0), tolls: z.number().finite().nonnegative().max(100000000).default(0), tip: z.number().finite().nonnegative().max(100000000).default(0), cod_collected: z.number().finite().nonnegative().max(100000000).default(0), remitted: z.boolean().default(false) }).strict(),
  z.object({ kind: z.literal("geocode"), address: z.string().trim().min(5).max(500) }).strict(),
  z.object({ kind: z.literal("route"), points: z.array(geoPointSchema).min(1).max(100) }).strict(),
]);

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req); const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "dashboard:read")) return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  const sup = adminSupabaseOr503(cid); if ("response" in sup) return sup.response;
  const tenantHeader = req.headers.get("x-tenant-key")?.trim();
  if (process.env.NODE_ENV === "production" && !tenantHeader) return correlatedJson(cid, { error: "Tenant scope is required" }, { status: 400 });
  const tenantKey = tenantHeader || "default";
  const [couriers, exceptions] = await Promise.all([
    sup.client.from("delivery_logistics_couriers").select("*").eq("tenant_key", tenantKey).order("updated_at", { ascending: false }).limit(200),
    sup.client.from("delivery_logistics_exceptions").select("*").eq("tenant_key", tenantKey).is("resolved_at", null).order("created_at", { ascending: false }).limit(200),
  ]);
  for (const result of [couriers, exceptions]) if (result.error && !/relation .* does not exist/i.test(result.error.message)) throw result.error;
  return correlatedJson(cid, { data: { couriers: couriers.data ?? [], openExceptions: exceptions.data ?? [] } });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req); const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "orders:write")) return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  const body = await parseBoundedJson(req, 256 * 1024);
  if (body.tooLarge) return correlatedJson(cid, { error: "Payload too large" }, { status: 413 });
  const parsed = operationSchema.safeParse(body.valid ? body.value : null);
  if (!parsed.success) return correlatedJson(cid, { error: "Invalid delivery operation payload" }, { status: 400 });
  const rec = parsed.data; const kind = rec.kind; const actor = session.user.email?.trim().toLowerCase() ?? "system";
  if (kind === "geocode") {
    try { return correlatedJson(cid, { data: await geocodeAddress(rec.address) }); } catch { return correlatedJson(cid, { error: "Geocoding provider unavailable" }, { status: 503 }); }
  }
  if (kind === "route") {
    try { return correlatedJson(cid, { data: await optimizeRouteWithProvider(rec.points) }); } catch { return correlatedJson(cid, { error: "Routing provider unavailable" }, { status: 503 }); }
  }
  const tenantHeader = req.headers.get("x-tenant-key")?.trim();
  if (process.env.NODE_ENV === "production" && !tenantHeader) return correlatedJson(cid, { error: "Tenant scope is required" }, { status: 400 });
  const tenantKey = tenantHeader || "default";
  const sup = adminSupabaseOr503(cid); if ("response" in sup) return sup.response;
  if (kind === "courier") {
    const slug = text(rec.slug); const label = text(rec.label);
    if (!slug || !label) return correlatedJson(cid, { error: "slug and label are required" }, { status: 400 });
    const result = await sup.client.from("delivery_logistics_couriers").upsert({ tenant_key: tenantKey, slug, label, phone: text(rec.phone), status: rec.status ?? "available", latitude: rec.latitude ?? null, longitude: rec.longitude ?? null, rating: rec.rating ?? 0, max_weight_kg: rec.max_weight_kg ?? 0, max_volume_cm3: rec.max_volume_cm3 ?? 0, cash_limit: rec.cash_limit ?? 10000, metadata: rec.metadata }, { onConflict: "tenant_key,slug" }).select("*").single();
    if (result.error) throw result.error; return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  const shipmentId = text(rec.shipment_id); if (!shipmentId) return correlatedJson(cid, { error: "shipment_id is required" }, { status: 400 });
  if (kind === "telemetry") {
    if (typeof rec.latitude !== "number" || typeof rec.longitude !== "number") return correlatedJson(cid, { error: "latitude and longitude are required" }, { status: 400 });
    const idempotencyKey = req.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
    const result = await sup.client.from("delivery_logistics_telemetry").insert({ tenant_key: tenantKey, shipment_id: shipmentId, courier_id: text(rec.courier_id), latitude: rec.latitude, longitude: rec.longitude, speed_kph: rec.speed_kph ?? null, heading: rec.heading ?? null, captured_at: rec.captured_at ?? new Date().toISOString(), idempotency_key: idempotencyKey }).select("*").single();
    if (result.error) throw result.error; return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  if (kind === "proof") {
    const method = rec.method;
    const shipment = await sup.client.from("delivery_logistics_shipments").select("destination_address,geocoded_destination").eq("id", shipmentId).eq("tenant_key", tenantKey).maybeSingle();
    const storedDestination = shipment.data?.geocoded_destination && typeof shipment.data.geocoded_destination === "object" && "latitude" in shipment.data.geocoded_destination && "longitude" in shipment.data.geocoded_destination ? shipment.data.geocoded_destination as { latitude: number; longitude: number } : null;
    const destination = rec.destination ?? storedDestination ?? undefined;
    const proofCheck = verifyDeliveryProof({ method, recipientName: rec.recipient_name, otp: rec.otp, expectedOtp: rec.expected_otp, latitude: rec.latitude, longitude: rec.longitude, destination, photoUrl: rec.photo_url, signature: rec.signature, contactLog: rec.contact_log });
    if (rec.verified && destination && typeof rec.latitude === "number" && typeof rec.longitude === "number") {
      try { assertDeliveryGeofence(destination, { latitude: rec.latitude, longitude: rec.longitude }); } catch { return correlatedJson(cid, { error: "Delivery proof is outside the destination geofence" }, { status: 400 }); }
    }
    if (rec.verified && !proofCheck.valid) return correlatedJson(cid, { error: "Delivery proof verification failed" }, { status: 400 });
    const result = await sup.client.from("delivery_logistics_proofs").insert({ tenant_key: tenantKey, shipment_id: shipmentId, method, recipient_name: text(rec.recipient_name), photo_url: text(rec.photo_url), signature: text(rec.signature), contact_log: text(rec.contact_log), otp_digest: text(rec.otp_digest), latitude: rec.latitude ?? null, longitude: rec.longitude ?? null, verified: rec.verified, verified_at: rec.verified ? new Date().toISOString() : null, created_by_email: actor }).select("*").single();
    if (result.error) throw result.error;
    if (rec.verified) await sup.client.from("delivery_logistics_shipments").update({ status: "delivered", proof_of_delivery: { proof_id: result.data.id, method, verified_at: result.data.verified_at } }).eq("id", shipmentId).eq("tenant_key", tenantKey);
    return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  if (kind === "exception") {
    const exceptionType = text(rec.exception_type); const details = text(rec.details);
    if (!exceptionType || !details) return correlatedJson(cid, { error: "exception_type and details are required" }, { status: 400 });
    const result = await sup.client.from("delivery_logistics_exceptions").insert({ tenant_key: tenantKey, shipment_id: shipmentId, exception_type: exceptionType, severity: rec.severity ?? "medium", details, created_by_email: actor }).select("*").single();
    if (result.error) throw result.error; return correlatedJson(cid, { data: result.data }, { status: 201 });
  }
  if (kind === "settlement") {
    if (rec.remitted && !rec.courier_id) return correlatedJson(cid, { error: "courier_id is required for remittance" }, { status: 400 });
    const idempotencyKey = req.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return correlatedJson(cid, { error: "Idempotency-Key is required" }, { status: 400 });
    const driverEarnings = calculateDriverEarnings({ deliveryFee: rec.delivery_fee, tip: rec.tip, tolls: rec.tolls, commissionRate: 0 });
    const result = await sup.client.from("delivery_logistics_settlements").upsert({ tenant_key: tenantKey, shipment_id: shipmentId, courier_id: text(rec.courier_id), delivery_fee: rec.delivery_fee, driver_earnings: driverEarnings, tolls: rec.tolls, tip: rec.tip, cod_collected: rec.cod_collected, remitted_at: rec.remitted ? new Date().toISOString() : null, remitted_by_email: rec.remitted ? actor : null }, { onConflict: "tenant_key,shipment_id" }).select("*").single();
    if (result.error) throw result.error;
    if (rec.courier_id) {
      const courierQuery = /^[0-9a-f-]{36}$/i.test(rec.courier_id) ? sup.client.from("delivery_logistics_couriers").select("id").eq("id", rec.courier_id).eq("tenant_key", tenantKey) : sup.client.from("delivery_logistics_couriers").select("id").eq("slug", rec.courier_id).eq("tenant_key", tenantKey);
      const courier = await courierQuery.maybeSingle();
      if (courier.data?.id) {
        const earning = await sup.client.from("delivery_driver_earnings").upsert({ tenant_key: tenantKey, courier_id: courier.data.id, shipment_id: shipmentId, delivery_fee: rec.delivery_fee, tip: rec.tip, tolls: rec.tolls, commission_rate: 0, net_earnings: driverEarnings, status: rec.remitted ? "paid" : "pending" }, { onConflict: "tenant_key,courier_id,shipment_id" }).select("*").single();
        if (earning.error) return correlatedJson(cid, { error: "Unable to persist driver earnings" }, { status: 503 });
        if (rec.cod_collected > 0) {
          const cash = await sup.client.from("delivery_courier_cash_ledger").insert({ tenant_key: tenantKey, courier_id: courier.data.id, shipment_id: shipmentId, amount: rec.cod_collected, direction: rec.remitted ? "remit" : "collect", idempotency_key: idempotencyKey, created_by_email: actor }).select("*").single();
          if (cash.error && !/duplicate key/i.test(cash.error.message)) return correlatedJson(cid, { error: "Unable to persist COD custody" }, { status: 503 });
        }
        return correlatedJson(cid, { data: { settlement: result.data, earnings: earning.data } }, { status: 201 });
      }
    }
    return correlatedJson(cid, { data: { settlement: result.data } }, { status: 201 });
  }
  return correlatedJson(cid, { error: "kind must be courier, telemetry, proof, exception, or settlement" }, { status: 400 });
}

export const POST = withAdminMutationIdempotency("/admin/delivery-logistics/operations:POST", post);
