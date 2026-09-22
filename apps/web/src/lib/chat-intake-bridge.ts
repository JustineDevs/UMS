import { fetchWorkerChatOrdersForAdmin, type WorkerChatOrder } from "./worker-admin-bridge";

export type ChatIntakeRow = {
  id: string;
  source: string;
  status: string;
  phone: string | null;
  address: string | null;
  raw_text: string | null;
  commerce_cart_id: string | null;
  commerce_order_id: string | null;
  commerce_order_display_id: string | null;
  commerce_payment_status: string | null;
  payment_provider: string | null;
  payment_external_id: string | null;
  payment_status: string | null;
  created_at: string;
};

const allowedTransitions: Record<string, readonly string[]> = {
  pending: ["processing", "cancelled"],
  draft_created: ["processing", "cancelled"],
  failed: ["processing", "cancelled"],
  processing: ["cancelled"],
  pending_payment: ["cancelled"],
  completed: [],
  cancelled: [],
};

export function isAllowedChatOrderTransition(currentStatus: string, nextStatus: string): boolean {
  return (allowedTransitions[currentStatus] ?? []).includes(nextStatus);
}

export async function fetchRecentChatIntake(limit = 50): Promise<ChatIntakeRow[] | null> {
  const rows = await fetchWorkerChatOrdersForAdmin(limit);
  if (!rows) return null;
  return rows.map((row: WorkerChatOrder) => ({
    id: row.id,
    source: row.source,
    status: row.status,
    phone: row.phone,
    address: row.address,
    raw_text: row.raw_text,
    // Keep the page's compatibility shape; the value is a native commerce cart ID.
    commerce_cart_id: row.commerce_cart_id,
    commerce_order_id: row.commerce_order_id,
    commerce_order_display_id: row.commerce_order_display_id,
    commerce_payment_status: row.commerce_payment_status,
    payment_provider: row.payment_provider,
    payment_external_id: row.payment_external_id,
    payment_status: row.payment_status,
    created_at: row.created_at,
  }));
}
