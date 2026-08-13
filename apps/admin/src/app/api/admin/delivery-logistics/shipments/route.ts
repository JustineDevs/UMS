import { withAdminMutationIdempotency } from "@/lib/admin-mutation-idempotency";
import { NextRequest } from "next/server";
import { getStaffSession } from "@/lib/requireStaffSession";
import { staffSessionAllows } from "@universal-music-store/database";
import {
  appendDeliveryLogisticsEvent,
  listDeliveryLogisticsEvents,
  listDeliveryLogisticsShipments,
  upsertDeliveryLogisticsShipment,
} from "@universal-music-store/platform-data";
import { adminSupabaseOr503 } from "@/lib/require-admin-supabase";
import { getCorrelationId } from "@/lib/request-correlation";
import { correlatedJson } from "@/lib/staff-api-response";

function cleanText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "dashboard:read")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const [shipments, events] = await Promise.all([
    listDeliveryLogisticsShipments(sup.client, { limit: 50 }),
    listDeliveryLogisticsEvents(sup.client, { limit: 50 }),
  ]);
  return correlatedJson(cid, { data: { shipments, events } });
}

async function post(req: NextRequest) {
  const cid = getCorrelationId(req);
  const session = await getStaffSession();
  if (!session?.user) return correlatedJson(cid, { error: "Unauthorized" }, { status: 401 });
  if (!staffSessionAllows(session, "orders:write")) {
    return correlatedJson(cid, { error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return correlatedJson(cid, { error: "Invalid JSON" }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  const kind = cleanText(rec.kind);
  const sup = adminSupabaseOr503(cid);
  if ("response" in sup) return sup.response;
  const sb = sup.client;
  const actorEmail = session.user.email?.trim().toLowerCase() ?? null;

  if (kind === "shipment") {
    const orderId = cleanText(rec.order_id);
    const customerEmail = cleanText(rec.customer_email);
    if (!orderId || !customerEmail) {
      return correlatedJson(cid, { error: "order_id and customer_email are required" }, { status: 400 });
    }

    const row = await upsertDeliveryLogisticsShipment(sb, {
      order_id: orderId,
      order_display_id: cleanText(rec.order_display_id),
      customer_email: customerEmail,
      branch_id: cleanText(rec.branch_id),
      courier_slug: cleanText(rec.courier_slug),
      courier_label: cleanText(rec.courier_label),
      status:
        rec.status === "assigned" ||
        rec.status === "in_transit" ||
        rec.status === "delivered" ||
        rec.status === "returned" ||
        rec.status === "cancelled"
          ? rec.status
          : "planned",
      origin_address:
        rec.origin_address && typeof rec.origin_address === "object" && !Array.isArray(rec.origin_address)
          ? (rec.origin_address as Record<string, unknown>)
          : {},
      destination_address:
        rec.destination_address && typeof rec.destination_address === "object" && !Array.isArray(rec.destination_address)
          ? (rec.destination_address as Record<string, unknown>)
          : {},
      geocoded_destination:
        rec.geocoded_destination && typeof rec.geocoded_destination === "object" && !Array.isArray(rec.geocoded_destination)
          ? (rec.geocoded_destination as Record<string, unknown>)
          : {},
      sla_code: cleanText(rec.sla_code),
      sla_label: cleanText(rec.sla_label),
      package_dimensions:
        rec.package_dimensions && typeof rec.package_dimensions === "object" && !Array.isArray(rec.package_dimensions)
          ? (rec.package_dimensions as Record<string, unknown>)
          : {},
      hazard_flags: Array.isArray(rec.hazard_flags)
        ? rec.hazard_flags.map((value) => String(value))
        : [],
      route_metadata:
        rec.route_metadata && typeof rec.route_metadata === "object" && !Array.isArray(rec.route_metadata)
          ? (rec.route_metadata as Record<string, unknown>)
          : {},
      tracking_url: cleanText(rec.tracking_url),
      tracking_status: cleanText(rec.tracking_status),
      proof_of_delivery:
        rec.proof_of_delivery && typeof rec.proof_of_delivery === "object" && !Array.isArray(rec.proof_of_delivery)
          ? (rec.proof_of_delivery as Record<string, unknown>)
          : {},
      cod_amount: typeof rec.cod_amount === "number" ? rec.cod_amount : null,
      driver_cash_balance: typeof rec.driver_cash_balance === "number" ? rec.driver_cash_balance : null,
      settlement_status:
        rec.settlement_status === "held" ||
        rec.settlement_status === "reconciled" ||
        rec.settlement_status === "remitted" ||
        rec.settlement_status === "none"
          ? rec.settlement_status
          : "pending",
      pricing:
        rec.pricing && typeof rec.pricing === "object" && !Array.isArray(rec.pricing)
          ? (rec.pricing as Record<string, unknown>)
          : {},
      metadata:
        rec.metadata && typeof rec.metadata === "object" && !Array.isArray(rec.metadata)
          ? (rec.metadata as Record<string, unknown>)
          : {},
      last_event_at: cleanText(rec.last_event_at),
      created_by_email: actorEmail,
      updated_by_email: actorEmail,
    });

    return correlatedJson(cid, { data: row }, { status: 201 });
  }

  if (kind === "event") {
    const shipmentId = cleanText(rec.shipment_id);
    const eventType = cleanText(rec.event_type);
    if (!shipmentId || !eventType) {
      return correlatedJson(cid, { error: "shipment_id and event_type are required" }, { status: 400 });
    }
    const event = await appendDeliveryLogisticsEvent(sb, {
      shipment_id: shipmentId,
      event_type: eventType,
      event_status: cleanText(rec.event_status),
      event_payload:
        rec.event_payload && typeof rec.event_payload === "object" && !Array.isArray(rec.event_payload)
          ? (rec.event_payload as Record<string, unknown>)
          : {},
      occurred_at: cleanText(rec.occurred_at) ?? undefined,
      created_by_email: actorEmail,
    });
    return correlatedJson(cid, { data: event }, { status: 201 });
  }

  return correlatedJson(cid, { error: "kind must be shipment or event" }, { status: 400 });
}

export const POST = withAdminMutationIdempotency("/admin/delivery-logistics/shipments:POST", post);
