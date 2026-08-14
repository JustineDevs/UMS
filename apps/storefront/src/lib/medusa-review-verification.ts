import { medusaAdminFetch } from "@/lib/medusa-admin-fetch";

export type VerifiedPurchaseResult =
  | { verified: true; orderId: string }
  | { verified: false };

/**
 * Completed / paid order: Medusa v2 uses `payment_status` and `status`.
 * We treat captured payment or completed/archived fulfillment as eligible for "verified buyer".
 */
export function orderQualifiesForVerifiedPurchase(order: {
  status?: string | null;
  payment_status?: string | null;
}): boolean {
  const st = String(order.status ?? "").toLowerCase();
  if (st === "completed" || st === "archived") {
    return true;
  }
  if (st === "canceled") {
    return false;
  }
  const ps = String(order.payment_status ?? "").toLowerCase();
  if (ps === "canceled" || ps === "not_paid" || ps === "awaiting") {
    return false;
  }
  if (ps === "captured" || ps === "partially_refunded") {
    return true;
  }
  return false;
}

function lineItemProductIds(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];
  const o = item as Record<string, unknown>;
  const out: string[] = [];
  if (typeof o.product_id === "string" && o.product_id.length > 0) {
    out.push(o.product_id);
  }
  const variant = o.variant;
  if (variant && typeof variant === "object") {
    const v = variant as Record<string, unknown>;
    if (typeof v.product_id === "string" && v.product_id.length > 0) {
      out.push(v.product_id);
    }
    const p = v.product;
    if (p && typeof p === "object") {
      const pid = (p as { id?: string }).id;
      if (typeof pid === "string" && pid.length > 0) out.push(pid);
    }
  }
  return out;
}

function orderContainsProduct(
  orderPayload: Record<string, unknown>,
  medusaProductId: string,
): boolean {
  const items = orderPayload.items;
  if (!Array.isArray(items)) return false;
  for (const it of items) {
    for (const pid of lineItemProductIds(it)) {
      if (pid === medusaProductId) return true;
    }
  }
  return false;
}

/**
 * Lists recent orders for the customer and finds one that is paid/completed and includes the product.
 * Product match is at Medusa **product** id (all variants of that product count).
 */
export async function findVerifiedProductPurchaseForCustomer(
  customerId: string,
  medusaProductId: string,
): Promise<VerifiedPurchaseResult> {
  const want = medusaProductId.trim();
  if (!customerId.trim() || !want) return { verified: false };

  const pageSize = 50;
  for (let offset = 0; offset < 500; offset += pageSize) {
    const qs = new URLSearchParams();
    qs.set("limit", String(pageSize));
    qs.set("offset", String(offset));
    qs.set("order", "-created_at");
    qs.set("customer_id", customerId);
    qs.set(
      "fields",
      "id,status,payment_status,*items,*items.variant,*items.variant.product",
    );
    const res = await medusaAdminFetch(`/admin/orders?${qs.toString()}`);
    if (!res.ok) {
      return { verified: false };
    }
    const json = (await res.json()) as { orders?: unknown[] };
    const orders = Array.isArray(json.orders) ? json.orders : [];
    for (const raw of orders) {
      if (!raw || typeof raw !== "object") continue;
      const o = raw as Record<string, unknown>;
      if (!orderQualifiesForVerifiedPurchase(o)) continue;
      const oid = typeof o.id === "string" ? o.id : "";
      if (!oid) continue;
      if (!orderContainsProduct(o, want)) continue;
      return { verified: true, orderId: oid };
    }
    if (orders.length < pageSize) break;
  }
  return { verified: false };
}
