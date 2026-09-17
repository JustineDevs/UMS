const RETURNABLE_ORDER_STATUSES = new Set([
  "completed",
  "partially_fulfilled",
  "fulfilled",
  "shipped",
  "delivered",
]);

const NON_RETURNABLE_ORDER_STATUSES = new Set([
  "draft",
  "pending",
  "requires_action",
  "cancelled",
  "canceled",
  "expired",
  "archived",
]);

export type ReturnPolicyDecision =
  | { ok: true; status: string }
  | { ok: false; reason: "not_returnable" | "unknown_status"; status: string };

export function evaluateReturnableOrderStatus(
  value: unknown,
): ReturnPolicyDecision {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!status)
    return { ok: false, reason: "unknown_status", status: "unknown" };
  if (RETURNABLE_ORDER_STATUSES.has(status)) return { ok: true, status };
  if (NON_RETURNABLE_ORDER_STATUSES.has(status)) {
    return { ok: false, reason: "not_returnable", status };
  }
  return { ok: false, reason: "unknown_status", status };
}

export type ReturnRequestLine = {
  item_id: string;
  quantity: number;
  reason_id?: string;
  note?: string;
};
export type ReturnableOrderLine = {
  id?: unknown;
  quantity?: unknown;
  returned_quantity?: unknown;
};

export type ReturnLineValidation =
  | { ok: true }
  | { ok: false; reason: "unknown_item" | "quantity_exceeds_available" };

export function normalizeReturnRequestLines(
  requested: ReturnRequestLine[],
): ReturnRequestLine[] {
  return [...requested].sort((left, right) =>
    left.item_id.localeCompare(right.item_id),
  );
}

export function validateReturnRequestLines(
  requested: ReturnRequestLine[],
  orderLines: ReturnableOrderLine[],
): ReturnLineValidation {
  const available = new Map<string, number>();
  for (const line of orderLines) {
    const id = typeof line.id === "string" ? line.id.trim() : "";
    if (!id) continue;
    const quantity =
      typeof line.quantity === "number" && Number.isFinite(line.quantity)
        ? Math.max(0, Math.floor(line.quantity))
        : 0;
    const returned =
      typeof line.returned_quantity === "number" &&
      Number.isFinite(line.returned_quantity)
        ? Math.max(0, Math.floor(line.returned_quantity))
        : 0;
    available.set(id, Math.max(0, quantity - returned));
  }

  for (const line of requested) {
    const remaining = available.get(line.item_id);
    if (remaining === undefined) return { ok: false, reason: "unknown_item" };
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > remaining
    ) {
      return { ok: false, reason: "quantity_exceeds_available" };
    }
  }
  return { ok: true };
}
