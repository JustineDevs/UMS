/**
 * Local copy of receipt helpers (same behavior as @universal-music-store/platform-data digital-receipts)
 * so Medusa backend build does not compile the whole platform-data package under Medusa's TS config.
 *
 * Uses a structural client type so `createClient()` from a dynamic import matches without duplicate
 * @supabase/supabase-js nominal types (Node16 import vs require resolution in the Medusa compiler).
 */
export type DigitalReceiptSupabase = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => {
        /** Resolves to row data; Supabase returns a thenable builder, not a bare Promise. */
        single: () => PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export type DigitalReceipt = {
  id: string;
  order_id: string;
  customer_email: string | null;
  receipt_html: string;
  sent_at: string | null;
  created_at: string;
};

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
          <td style="padding:8px;border-bottom:1px solid #eee">${i.title}</td>
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
    <h2 style="margin:0">${order.storeName ?? "Universal Music Store"}</h2>
    <p style="color:#666;margin:4px 0">Order #${order.display_id ?? order.id}</p>
    <p style="color:#666;margin:4px 0">${order.created_at ? new Date(order.created_at).toLocaleDateString() : new Date().toLocaleDateString()}</p>
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
    Total: ${order.currency_code.toUpperCase()} ${(order.total / 100).toFixed(2)}
  </div>
  <div style="text-align:center;margin-top:32px;color:#999;font-size:12px">
    Thank you for your purchase.
  </div>
</body>
</html>`;
}

export async function saveReceipt(
  supabase: DigitalReceiptSupabase,
  input: {
    order_id: string;
    customer_email?: string;
    receipt_html: string;
  },
): Promise<DigitalReceipt> {
  const { data, error } = await supabase
    .from("digital_receipts")
    .insert({
      order_id: input.order_id,
      medusa_order_id: input.order_id,
      customer_email: input.customer_email ?? null,
      receipt_html: input.receipt_html,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToReceipt(data as Record<string, unknown>);
}

export async function markReceiptSent(
  supabase: DigitalReceiptSupabase,
  receiptId: string,
): Promise<void> {
  const { error } = await supabase
    .from("digital_receipts")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", receiptId);
  if (error) throw error;
}
