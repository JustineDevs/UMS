import type { SupabaseClient } from "@supabase/supabase-js";

export type DigitalReceipt = {
  id: string;
  order_id: string;
  customer_email: string | null;
  receipt_html: string;
  sent_at: string | null;
  created_at: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function rowToReceipt(row: Record<string, unknown>): DigitalReceipt {
  return {
    id: String(row.id ?? ""),
    order_id: String(row.order_id ?? ""),
    customer_email:
      row.customer_email != null ? String(row.customer_email) : null,
    receipt_html: String(row.receipt_html ?? ""),
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    created_at: String(row.created_at ?? new Date().toISOString()),
  };
}

export function buildReceiptHtml(order: {
  id: string;
  display_id?: string | number;
  items: Array<{
    title: string;
    quantity: number;
    unit_price: number;
  }>;
  total: number;
  currency_code: string;
  created_at?: string;
  storeName?: string;
}): string {
  const itemRows = order.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.title)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${(i.unit_price / 100).toFixed(2)}</td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Receipt</title></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
  <div style="text-align:center;margin-bottom:24px">
    <h2 style="margin:0">${escapeHtml(order.storeName ?? "Universal Music Store")}</h2>
    <p style="color:#666;margin:4px 0">Order #${escapeHtml(order.display_id ?? order.id)}</p>
    <p style="color:#666;margin:4px 0">${escapeHtml(order.created_at ? new Date(order.created_at).toLocaleDateString("en-PH") : new Date().toLocaleDateString("en-PH"))}</p>
  </div>
  <table style="width:100%;border-collapse:collapse">
    <thead>
      <tr style="background:#f9f9f9">
        <th style="padding:8px;text-align:left">Item</th>
        <th style="padding:8px;text-align:center">Qty</th>
        <th style="padding:8px;text-align:right">Price</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div style="text-align:right;margin-top:16px;font-size:18px;font-weight:bold">
    Total: ${escapeHtml(order.currency_code.toUpperCase())} ${(order.total / 100).toFixed(2)}
  </div>
  <div style="text-align:center;margin-top:32px;color:#999;font-size:12px">
    Thank you for your purchase.
  </div>
</body>
</html>`;
}

export async function saveReceipt(
  supabase: SupabaseClient,
  input: {
    order_id: string;
    organization_id?: string;
    customer_email?: string;
    receipt_html: string;
  },
): Promise<DigitalReceipt> {
  const { data, error } = await supabase
    .from("digital_receipts")
    .insert({
      order_id: input.order_id,
      medusa_order_id: input.order_id,
      organization_id: input.organization_id ?? null,
      customer_email: input.customer_email ?? null,
      receipt_html: input.receipt_html,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToReceipt(data as Record<string, unknown>);
}

export async function markReceiptSent(
  supabase: SupabaseClient,
  receiptId: string,
): Promise<void> {
  const { error } = await supabase
    .from("digital_receipts")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", receiptId);
  if (error) throw error;
}

export async function getReceiptByOrder(
  supabase: SupabaseClient,
  orderId: string,
  organizationId?: string,
): Promise<DigitalReceipt | null> {
  let query = supabase
    .from("digital_receipts")
    .select("*")
    .eq("order_id", orderId);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return rowToReceipt(data as Record<string, unknown>);
}
