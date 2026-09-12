import type { SupabaseClient } from "@supabase/supabase-js";

export type CanonicalOrderStatus =
  | "pending" | "paid" | "processing" | "packed" | "shipped"
  | "delivered" | "cancelled" | "returned" | "refunded" | "failed";

export const CANONICAL_ORDER_STATUS_BY_SOURCE: Record<string, CanonicalOrderStatus> = {
  pending: "pending", created: "pending", awaiting_payment: "pending", paid: "paid", captured: "paid",
  processing: "processing", packed: "packed", shipped: "shipped", fulfilled: "shipped", delivered: "delivered",
  cancelled: "cancelled", canceled: "cancelled", returned: "returned", refunded: "refunded", failed: "failed",
};
export function canonicalOrderStatusFor(sourceStatus: string): CanonicalOrderStatus {
  const status = CANONICAL_ORDER_STATUS_BY_SOURCE[sourceStatus.trim().toLowerCase()];
  if (!status) throw new Error(`Unsupported order status: ${sourceStatus}`);
  return status;
}

const transitions: Record<CanonicalOrderStatus, readonly CanonicalOrderStatus[]> = {
  pending: ["paid", "cancelled", "failed"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["packed", "cancelled", "refunded"],
  packed: ["shipped", "cancelled"],
  shipped: ["delivered", "returned"],
  delivered: ["returned", "refunded"],
  cancelled: [],
  returned: ["refunded"],
  refunded: [],
  failed: ["pending", "cancelled"],
};

export function assertCanonicalOrderTransition(
  from: CanonicalOrderStatus | null,
  to: CanonicalOrderStatus,
): void {
  if (from === to) return;
  if (from !== null && !transitions[from].includes(to)) {
    throw new Error(`Invalid canonical order transition: ${from} -> ${to}`);
  }
}

export async function appendCanonicalOrderState(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    medusaOrderId: string;
    status: CanonicalOrderStatus;
    previousStatus?: CanonicalOrderStatus | null;
    eventType: string;
    source: string;
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
    occurredAt?: string;
  },
) {
  const organizationId = input.organizationId.trim();
  const medusaOrderId = input.medusaOrderId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!organizationId || !medusaOrderId || !idempotencyKey) throw new Error("organizationId, medusaOrderId, and idempotencyKey are required");
  assertCanonicalOrderTransition(input.previousStatus ?? null, input.status);
  const { data, error } = await supabase.rpc("append_canonical_order_state", {
    p_organization_id: organizationId,
    p_medusa_order_id: medusaOrderId,
    p_status: input.status,
    p_event_type: input.eventType.trim(),
    p_source: input.source.trim(),
    p_idempotency_key: idempotencyKey,
    p_metadata: input.metadata ?? {},
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
  });
  if (error) throw error;
  return data;
}
