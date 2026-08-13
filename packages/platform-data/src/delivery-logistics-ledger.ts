import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingTableOrSchemaError } from "./supabase-errors.js";

export type DeliveryLogisticsShipmentStatus =
  | "planned"
  | "assigned"
  | "in_transit"
  | "delivered"
  | "returned"
  | "cancelled";

export type DeliveryLogisticsSettlementStatus =
  | "pending"
  | "held"
  | "reconciled"
  | "remitted"
  | "none";

export type DeliveryLogisticsShipmentRow = {
  id: string;
  order_id: string;
  order_display_id: string | null;
  customer_email: string;
  branch_id: string | null;
  courier_slug: string | null;
  courier_label: string | null;
  status: DeliveryLogisticsShipmentStatus;
  origin_address: Record<string, unknown>;
  destination_address: Record<string, unknown>;
  geocoded_destination: Record<string, unknown>;
  sla_code: string | null;
  sla_label: string | null;
  package_dimensions: Record<string, unknown>;
  hazard_flags: readonly string[];
  route_metadata: Record<string, unknown>;
  tracking_url: string | null;
  tracking_status: string | null;
  proof_of_delivery: Record<string, unknown>;
  cod_amount: number | null;
  driver_cash_balance: number | null;
  settlement_status: DeliveryLogisticsSettlementStatus;
  pricing: Record<string, unknown>;
  metadata: Record<string, unknown>;
  last_event_at: string | null;
  created_by_email: string | null;
  updated_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export type DeliveryLogisticsEventRow = {
  id: string;
  shipment_id: string;
  event_type: string;
  event_status: string | null;
  event_payload: Record<string, unknown>;
  occurred_at: string;
  created_by_email: string | null;
  created_at: string;
};

function rowToShipment(row: Record<string, unknown>): DeliveryLogisticsShipmentRow {
  const status =
    row.status === "assigned" ||
    row.status === "in_transit" ||
    row.status === "delivered" ||
    row.status === "returned" ||
    row.status === "cancelled"
      ? row.status
      : "planned";
  const settlementStatus =
    row.settlement_status === "held" ||
    row.settlement_status === "reconciled" ||
    row.settlement_status === "remitted" ||
    row.settlement_status === "none"
      ? row.settlement_status
      : "pending";
  return {
    id: String(row.id ?? ""),
    order_id: String(row.order_id ?? ""),
    order_display_id:
      row.order_display_id != null ? String(row.order_display_id) : null,
    customer_email: String(row.customer_email ?? ""),
    branch_id: row.branch_id != null ? String(row.branch_id) : null,
    courier_slug: row.courier_slug != null ? String(row.courier_slug) : null,
    courier_label: row.courier_label != null ? String(row.courier_label) : null,
    status,
    origin_address:
      row.origin_address && typeof row.origin_address === "object" && !Array.isArray(row.origin_address)
        ? (row.origin_address as Record<string, unknown>)
        : {},
    destination_address:
      row.destination_address && typeof row.destination_address === "object" && !Array.isArray(row.destination_address)
        ? (row.destination_address as Record<string, unknown>)
        : {},
    geocoded_destination:
      row.geocoded_destination && typeof row.geocoded_destination === "object" && !Array.isArray(row.geocoded_destination)
        ? (row.geocoded_destination as Record<string, unknown>)
        : {},
    sla_code: row.sla_code != null ? String(row.sla_code) : null,
    sla_label: row.sla_label != null ? String(row.sla_label) : null,
    package_dimensions:
      row.package_dimensions && typeof row.package_dimensions === "object" && !Array.isArray(row.package_dimensions)
        ? (row.package_dimensions as Record<string, unknown>)
        : {},
    hazard_flags: Array.isArray(row.hazard_flags)
      ? row.hazard_flags.map((value) => String(value))
      : [],
    route_metadata:
      row.route_metadata && typeof row.route_metadata === "object" && !Array.isArray(row.route_metadata)
        ? (row.route_metadata as Record<string, unknown>)
        : {},
    tracking_url: row.tracking_url != null ? String(row.tracking_url) : null,
    tracking_status: row.tracking_status != null ? String(row.tracking_status) : null,
    proof_of_delivery:
      row.proof_of_delivery && typeof row.proof_of_delivery === "object" && !Array.isArray(row.proof_of_delivery)
        ? (row.proof_of_delivery as Record<string, unknown>)
        : {},
    cod_amount:
      typeof row.cod_amount === "number" ? row.cod_amount : row.cod_amount != null ? Number(row.cod_amount) : null,
    driver_cash_balance:
      typeof row.driver_cash_balance === "number"
        ? row.driver_cash_balance
        : row.driver_cash_balance != null
          ? Number(row.driver_cash_balance)
          : null,
    settlement_status: settlementStatus,
    pricing:
      row.pricing && typeof row.pricing === "object" && !Array.isArray(row.pricing)
        ? (row.pricing as Record<string, unknown>)
        : {},
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    last_event_at: row.last_event_at != null ? String(row.last_event_at) : null,
    created_by_email:
      row.created_by_email != null ? String(row.created_by_email) : null,
    updated_by_email:
      row.updated_by_email != null ? String(row.updated_by_email) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

function rowToEvent(row: Record<string, unknown>): DeliveryLogisticsEventRow {
  return {
    id: String(row.id ?? ""),
    shipment_id: String(row.shipment_id ?? ""),
    event_type: String(row.event_type ?? ""),
    event_status: row.event_status != null ? String(row.event_status) : null,
    event_payload:
      row.event_payload && typeof row.event_payload === "object" && !Array.isArray(row.event_payload)
        ? (row.event_payload as Record<string, unknown>)
        : {},
    occurred_at: String(row.occurred_at ?? new Date().toISOString()),
    created_by_email:
      row.created_by_email != null ? String(row.created_by_email) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export async function listDeliveryLogisticsShipments(
  supabase: SupabaseClient,
  options: { limit?: number; status?: DeliveryLogisticsShipmentStatus } = {},
): Promise<DeliveryLogisticsShipmentRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  let query = supabase
    .from("delivery_logistics_shipments")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (options.status) query = query.eq("status", options.status);
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToShipment(row as Record<string, unknown>));
}

export async function upsertDeliveryLogisticsShipment(
  supabase: SupabaseClient,
  input: {
    order_id: string;
    order_display_id?: string | null;
    customer_email: string;
    branch_id?: string | null;
    courier_slug?: string | null;
    courier_label?: string | null;
    status?: DeliveryLogisticsShipmentStatus;
    origin_address?: Record<string, unknown>;
    destination_address?: Record<string, unknown>;
    geocoded_destination?: Record<string, unknown>;
    sla_code?: string | null;
    sla_label?: string | null;
    package_dimensions?: Record<string, unknown>;
    hazard_flags?: readonly string[];
    route_metadata?: Record<string, unknown>;
    tracking_url?: string | null;
    tracking_status?: string | null;
    proof_of_delivery?: Record<string, unknown>;
    cod_amount?: number | null;
    driver_cash_balance?: number | null;
    settlement_status?: DeliveryLogisticsSettlementStatus;
    pricing?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    last_event_at?: string | null;
    created_by_email?: string | null;
    updated_by_email?: string | null;
  },
): Promise<DeliveryLogisticsShipmentRow> {
  const payload = {
    order_id: input.order_id.trim(),
    order_display_id: input.order_display_id?.trim() || null,
    customer_email: input.customer_email.trim().toLowerCase(),
    branch_id: input.branch_id?.trim() || null,
    courier_slug: input.courier_slug?.trim() || null,
    courier_label: input.courier_label?.trim() || null,
    status: input.status ?? "planned",
    origin_address: input.origin_address ?? {},
    destination_address: input.destination_address ?? {},
    geocoded_destination: input.geocoded_destination ?? {},
    sla_code: input.sla_code?.trim() || null,
    sla_label: input.sla_label?.trim() || null,
    package_dimensions: input.package_dimensions ?? {},
    hazard_flags: [...(input.hazard_flags ?? [])],
    route_metadata: input.route_metadata ?? {},
    tracking_url: input.tracking_url?.trim() || null,
    tracking_status: input.tracking_status?.trim() || null,
    proof_of_delivery: input.proof_of_delivery ?? {},
    cod_amount: input.cod_amount ?? null,
    driver_cash_balance: input.driver_cash_balance ?? null,
    settlement_status: input.settlement_status ?? "pending",
    pricing: input.pricing ?? {},
    metadata: input.metadata ?? {},
    last_event_at: input.last_event_at ?? null,
    created_by_email: input.created_by_email?.trim() || null,
    updated_by_email: input.updated_by_email?.trim() || null,
  };
  const { data, error } = await supabase
    .from("delivery_logistics_shipments")
    .upsert(payload, { onConflict: "order_id" })
    .select("*")
    .single();
  if (error) throw error;
  return rowToShipment(data as Record<string, unknown>);
}

export async function listDeliveryLogisticsEvents(
  supabase: SupabaseClient,
  options: { shipmentId?: string; limit?: number } = {},
): Promise<DeliveryLogisticsEventRow[]> {
  const limit = Math.min(500, Math.max(1, options.limit ?? 100));
  let query = supabase
    .from("delivery_logistics_events")
    .select("*")
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (options.shipmentId) {
    query = query.eq("shipment_id", options.shipmentId.trim());
  }
  const { data, error } = await query;
  if (error) {
    if (isMissingTableOrSchemaError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row) => rowToEvent(row as Record<string, unknown>));
}

export async function appendDeliveryLogisticsEvent(
  supabase: SupabaseClient,
  input: {
    shipment_id: string;
    event_type: string;
    event_status?: string | null;
    event_payload?: Record<string, unknown>;
    occurred_at?: string;
    created_by_email?: string | null;
  },
): Promise<DeliveryLogisticsEventRow> {
  const { data, error } = await supabase
    .from("delivery_logistics_events")
    .insert({
      shipment_id: input.shipment_id.trim(),
      event_type: input.event_type.trim(),
      event_status: input.event_status?.trim() || null,
      event_payload: input.event_payload ?? {},
      occurred_at: input.occurred_at ?? new Date().toISOString(),
      created_by_email: input.created_by_email?.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (input.event_status || input.occurred_at) {
    const updatePatch: Record<string, unknown> = {
      last_event_at: input.occurred_at ?? new Date().toISOString(),
    };
    if (input.event_status?.trim()) {
      updatePatch.tracking_status = input.event_status.trim();
    }
    await supabase
      .from("delivery_logistics_shipments")
      .update(updatePatch)
      .eq("id", input.shipment_id.trim());
  }

  return rowToEvent(data as Record<string, unknown>);
}
