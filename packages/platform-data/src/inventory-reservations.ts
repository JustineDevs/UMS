import type { SupabaseClient } from "@supabase/supabase-js";

export type InventoryReservationStatus = "active" | "released" | "committed";
export type InventoryReservationReconciliationStatus =
  | "pending"
  | "matched"
  | "discrepancy"
  | "needs_review"
  | "resolved";

export type InventoryQuantitySemantics = { stocked: number; reserved: number; available: number; sellable: number };
export function deriveInventoryQuantitySemantics(input: { stocked: number; reserved: number }): InventoryQuantitySemantics {
  const stocked = Math.max(0, Math.trunc(input.stocked));
  const reserved = Math.min(stocked, Math.max(0, Math.trunc(input.reserved)));
  return { stocked, reserved, available: stocked - reserved, sellable: stocked - reserved };
}

export type InventoryReservationRow = {
  id: string;
  tenant_id: string;
  location_id: string;
  inventory_item_id: string;
  quantity: number;
  status: InventoryReservationStatus;
  idempotency_key: string;
  medusa_reservation_id: string | null;
  medusa_closed_at: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: Record<string, unknown>;
  reserved_at: string;
  released_at: string | null;
  committed_at: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  expired_at: string | null;
  reconciliation_status: InventoryReservationReconciliationStatus;
};

export type ReserveInventoryInput = {
  tenantId: string;
  locationId: string;
  inventoryItemId: string;
  quantity: number;
  availableQuantity: number;
  idempotencyKey: string;
  referenceType?: string | null;
  referenceId?: string | null;
  metadata?: Record<string, unknown>;
};

export type FinalizeInventoryReservationInput = {
  tenantId: string;
  reservationId: string;
  idempotencyKey: string;
};

export type AttachMedusaReservationInput = FinalizeInventoryReservationInput & {
  medusaReservationId: string;
};

function clean(value: string, field: string): string {
  const out = value.trim();
  if (!out) throw new Error(`${field} is required`);
  return out;
}

function positiveInt(value: number, field: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

export function normalizeReserveInventoryInput(input: ReserveInventoryInput) {
  return {
    tenant_id: clean(input.tenantId, "tenantId"),
    location_id: clean(input.locationId, "locationId"),
    inventory_item_id: clean(input.inventoryItemId, "inventoryItemId"),
    quantity: positiveInt(input.quantity, "quantity"),
    available_quantity: Math.max(0, Math.trunc(input.availableQuantity)),
    idempotency_key: clean(input.idempotencyKey, "idempotencyKey"),
    reference_type: input.referenceType?.trim() || null,
    reference_id: input.referenceId?.trim() || null,
    metadata: input.metadata ?? {},
  };
}

function normalizeFinalizeInput(input: FinalizeInventoryReservationInput) {
  return {
    tenant_id: clean(input.tenantId, "tenantId"),
    reservation_id: clean(input.reservationId, "reservationId"),
    idempotency_key: clean(input.idempotencyKey, "idempotencyKey"),
  };
}

function rowToReservation(row: Record<string, unknown>): InventoryReservationRow {
  const status =
    row.status === "released" || row.status === "committed" ? row.status : "active";
  return {
    id: String(row.id ?? ""),
    tenant_id: String(row.tenant_id ?? ""),
    location_id: String(row.location_id ?? ""),
    inventory_item_id: String(row.inventory_item_id ?? ""),
    quantity: Number(row.quantity ?? 0),
    status,
    idempotency_key: String(row.idempotency_key ?? ""),
    medusa_reservation_id:
      row.medusa_reservation_id != null ? String(row.medusa_reservation_id) : null,
    medusa_closed_at: row.medusa_closed_at != null ? String(row.medusa_closed_at) : null,
    reference_type: row.reference_type != null ? String(row.reference_type) : null,
    reference_id: row.reference_id != null ? String(row.reference_id) : null,
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {},
    reserved_at: String(row.reserved_at ?? ""),
    released_at: row.released_at != null ? String(row.released_at) : null,
    committed_at: row.committed_at != null ? String(row.committed_at) : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    expired_at: row.expired_at != null ? String(row.expired_at) : null,
    reconciliation_status:
      row.reconciliation_status === "matched" ||
      row.reconciliation_status === "discrepancy" ||
      row.reconciliation_status === "needs_review" ||
      row.reconciliation_status === "resolved"
        ? row.reconciliation_status
        : "pending",
  };
}

async function runLifecycleRpc(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<InventoryReservationRow> {
  const { data, error } = await supabase.rpc("inventory_reservation_lifecycle", args);
  if (error) throw error;
  return rowToReservation(data as Record<string, unknown>);
}

export function reserveInventory(
  supabase: SupabaseClient,
  input: ReserveInventoryInput,
): Promise<InventoryReservationRow> {
  const normalized = normalizeReserveInventoryInput(input);
  return runLifecycleRpc(supabase, {
    p_operation: "reserve",
    p_tenant_id: normalized.tenant_id,
    p_location_id: normalized.location_id,
    p_inventory_item_id: normalized.inventory_item_id,
    p_quantity: normalized.quantity,
    p_available_quantity: normalized.available_quantity,
    p_idempotency_key: normalized.idempotency_key,
    p_reference_type: normalized.reference_type,
    p_reference_id: normalized.reference_id,
    p_metadata: normalized.metadata,
  });
}

export function releaseInventoryReservation(
  supabase: SupabaseClient,
  input: FinalizeInventoryReservationInput,
): Promise<InventoryReservationRow> {
  const normalized = normalizeFinalizeInput(input);
  return runLifecycleRpc(supabase, {
    p_operation: "release",
    p_tenant_id: normalized.tenant_id,
    p_reservation_id: normalized.reservation_id,
    p_idempotency_key: normalized.idempotency_key,
  });
}

export function commitInventoryReservation(
  supabase: SupabaseClient,
  input: FinalizeInventoryReservationInput,
): Promise<InventoryReservationRow> {
  const normalized = normalizeFinalizeInput(input);
  return runLifecycleRpc(supabase, {
    p_operation: "commit",
    p_tenant_id: normalized.tenant_id,
    p_reservation_id: normalized.reservation_id,
    p_idempotency_key: normalized.idempotency_key,
  });
}

export function attachMedusaInventoryReservation(
  supabase: SupabaseClient,
  input: AttachMedusaReservationInput,
): Promise<InventoryReservationRow> {
  const normalized = normalizeFinalizeInput(input);
  return runLifecycleRpc(supabase, {
    p_operation: "attach_medusa",
    p_tenant_id: normalized.tenant_id,
    p_reservation_id: normalized.reservation_id,
    p_idempotency_key: normalized.idempotency_key,
    p_medusa_reservation_id: clean(input.medusaReservationId, "medusaReservationId"),
  });
}

export function closeMedusaInventoryReservation(
  supabase: SupabaseClient,
  input: FinalizeInventoryReservationInput,
): Promise<InventoryReservationRow> {
  const normalized = normalizeFinalizeInput(input);
  return runLifecycleRpc(supabase, {
    p_operation: "close_medusa",
    p_tenant_id: normalized.tenant_id,
    p_reservation_id: normalized.reservation_id,
    p_idempotency_key: normalized.idempotency_key,
  });
}

export async function setInventoryReservationExpiry(
  supabase: SupabaseClient,
  input: { tenantId: string; reservationId: string; expiresAt: string },
): Promise<InventoryReservationRow> {
  const tenantId = clean(input.tenantId, "tenantId");
  const reservationId = clean(input.reservationId, "reservationId");
  const expiresAt = new Date(input.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
    throw new Error("expiresAt must be a future timestamp");
  }
  const { data, error } = await supabase.rpc("inventory_reservation_set_expiry", {
    p_tenant_id: tenantId,
    p_reservation_id: reservationId,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return rowToReservation(data as Record<string, unknown>);
}

export async function expireInventoryReservation(
  supabase: SupabaseClient,
  input: { tenantId: string; reservationId: string; idempotencyKey: string },
): Promise<InventoryReservationRow> {
  const { data, error } = await supabase.rpc("inventory_reservation_expire", {
    p_tenant_id: clean(input.tenantId, "tenantId"),
    p_reservation_id: clean(input.reservationId, "reservationId"),
    p_idempotency_key: clean(input.idempotencyKey, "idempotencyKey"),
  });
  if (error) throw error;
  return rowToReservation(data as Record<string, unknown>);
}

export async function expireDueInventoryReservations(
  supabase: SupabaseClient,
  input: { tenantId: string; limit?: number },
): Promise<number> {
  const { data, error } = await supabase.rpc("inventory_reservation_expire_due", {
    p_tenant_id: clean(input.tenantId, "tenantId"),
    p_limit: Math.min(5000, Math.max(1, Math.trunc(input.limit ?? 500))),
  });
  if (error) throw error;
  return Number(data ?? 0);
}
