import { medusaAdminFetch } from "@/lib/medusa-admin-http";

export type MedusaOrderRow = {
  id: string;
  order_number: string;
  customer_id: string | null;
  email: string | null;
  status: string;
  channel: string;
  currency: string;
  grand_total: number;
  created_at: string;
};

export async function fetchMedusaOrdersForAdmin(
  limit = 50,
  offset = 0,
): Promise<{
  orders: MedusaOrderRow[];
  total: number;
  /** True when Medusa could not be reached (e.g. still starting, wrong URL). */
  commerceUnavailable?: boolean;
}> {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  qs.set("offset", String(offset));
  qs.set(
    "fields",
    "id,display_id,status,currency_code,created_at,email,total,payment_status,fulfillment_status,metadata,*customer",
  );
  qs.set("order", "-created_at");
  let res: Response;
  try {
    res = await medusaAdminFetch(`/admin/orders?${qs.toString()}`, {
      method: "GET",
    });
  } catch {
    return { orders: [], total: 0, commerceUnavailable: true };
  }
  if (!res.ok) {
    return { orders: [], total: 0 };
  }
  const json = (await res.json()) as {
    orders?: unknown[];
    count?: number;
    limit?: number;
    offset?: number;
  };
  const rawOrders = Array.isArray(json.orders) ? json.orders : [];
  const orders: MedusaOrderRow[] = rawOrders.map((raw) => {
    const o = raw as Record<string, unknown>;
    const totalMinor = Number(o.total ?? 0);
    const grandTotal = Number.isFinite(totalMinor) ? totalMinor / 100 : 0;
    const currency = String(o.currency_code ?? "PHP").toUpperCase();
    return {
      id: String(o.id ?? ""),
      order_number:
        o.display_id != null ? String(o.display_id) : String(o.id ?? ""),
      customer_id:
        o.customer_id != null ? String(o.customer_id) : null,
      email: typeof o.email === "string" ? o.email : null,
      status: deriveOmsStatus(o),
      channel: "medusa",
      currency,
      grand_total: grandTotal,
      created_at:
        typeof o.created_at === "string"
          ? o.created_at
          : new Date().toISOString(),
    };
  });
  return { orders, total: json.count ?? orders.length };
}

export type MedusaShipmentRow = {
  id: string;
  tracking_number?: string | null;
  carrier_slug?: string | null;
  status?: string | null;
  label_url?: string | null;
  shipped_at?: string | null;
};

export type MedusaAdminOrderItem = {
  id: string;
  sku_snapshot: string;
  product_name_snapshot: string;
  size_snapshot: string;
  color_snapshot: string;
  unit_price: number;
  quantity: number;
  line_total: number;
};

export type MedusaAdminOrderDetail = {
  id: string;
  order_number: string;
  customer_id: string | null;
  status: string;
  channel: string;
  currency: string;
  subtotal: number;
  shipping_fee: number;
  grand_total: number;
  created_at: string;
  metadata: Record<string, unknown>;
  order_items?: MedusaAdminOrderItem[] | null;
};

function deriveOmsStatus(order: Record<string, unknown>): string {
  const meta = order.metadata as Record<string, unknown> | undefined;
  const fromMeta = meta?.oms_status;
  if (typeof fromMeta === "string" && fromMeta.trim()) {
    return fromMeta.trim();
  }
  if (
    meta?.payment_provider === "cod" &&
    meta?.cod_payment_status !== "captured" &&
    meta?.cod_capture_complete !== true
  ) {
    return "pending";
  }
  const ps = String(order.payment_status ?? "");
  const fs = String(order.fulfillment_status ?? "");
  if (fs === "fulfilled" || fs === "shipped") {
    return "shipped";
  }
  if (ps === "captured" || ps === "authorized") {
    return "paid";
  }
  return "pending";
}

function mapShipments(metadata: Record<string, unknown> | undefined): MedusaShipmentRow[] {
  const raw = metadata?.fulfillment_shipments;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((row, idx) => {
      const o = row as Record<string, unknown>;
      return {
        id: String(o.id ?? `shipment_${idx}`),
        tracking_number:
          typeof o.tracking_number === "string" ? o.tracking_number : null,
        carrier_slug:
          typeof o.carrier_slug === "string" ? o.carrier_slug : null,
        status: typeof o.status === "string" ? o.status : null,
        label_url: typeof o.label_url === "string" ? o.label_url : null,
        shipped_at: typeof o.shipped_at === "string" ? o.shipped_at : null,
      };
    })
    .filter((s) => s.id.length > 0);
}

function mapLineItems(items: unknown): MedusaAdminOrderItem[] {
  if (!Array.isArray(items)) {
    return [];
  }
  const out: MedusaAdminOrderItem[] = [];
  for (const it of items) {
    const item = it as Record<string, unknown>;
    const variant = item.variant as Record<string, unknown> | undefined;
    const product = variant?.product as Record<string, unknown> | undefined;
    const unitMinor = Number(item.unit_price ?? item.subtotal ?? 0);
    const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
    const unit = Number.isFinite(unitMinor) ? unitMinor / 100 : 0;
    out.push({
      id: String(item.id ?? ""),
      sku_snapshot: String(variant?.sku ?? item.variant_sku ?? ""),
      product_name_snapshot: String(
        product?.title ?? item.product_title ?? item.title ?? "",
      ),
      size_snapshot: "",
      color_snapshot: "",
      unit_price: unit,
      quantity: qty,
      line_total: unit * qty,
    });
  }
  return out;
}

function unwrapOrderPayload(json: unknown): Record<string, unknown> | null {
  if (!json || typeof json !== "object") {
    return null;
  }
  const root = json as Record<string, unknown>;
  if (root.order && typeof root.order === "object") {
    return root.order as Record<string, unknown>;
  }
  if (root.data && typeof root.data === "object") {
    const data = root.data as Record<string, unknown>;
    if (data.order && typeof data.order === "object") {
      return data.order as Record<string, unknown>;
    }
  }
  return root;
}

export async function fetchMedusaOrderDetailForAdmin(
  orderId: string,
): Promise<{ order: MedusaAdminOrderDetail; shipments: MedusaShipmentRow[] } | null> {
  const qs = new URLSearchParams();
  qs.set(
    "fields",
    "id,display_id,status,currency_code,created_at,email,metadata,subtotal,total,shipping_total,payment_status,fulfillment_status,*items,*items.variant,*items.variant.product,*customer",
  );
  const res = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?${qs.toString()}`,
    { method: "GET" },
  );
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as unknown;
  const order = unwrapOrderPayload(json);
  if (!order?.id) {
    return null;
  }

  const currency = String(order.currency_code ?? "PHP").toUpperCase();
  const totalMinor = Number(order.total ?? 0);
  const subMinor = Number(order.subtotal ?? 0);
  const shipMinor = Number(order.shipping_total ?? 0);
  const grandTotal = Number.isFinite(totalMinor) ? totalMinor / 100 : 0;
  const subtotal = Number.isFinite(subMinor) ? subMinor / 100 : 0;
  const shippingFee = Number.isFinite(shipMinor) ? shipMinor / 100 : 0;

  const metadata = order.metadata as Record<string, unknown> | undefined;

  const detail: MedusaAdminOrderDetail = {
    id: String(order.id),
    order_number:
      order.display_id != null ? String(order.display_id) : String(order.id),
    customer_id:
      order.customer_id != null ? String(order.customer_id) : null,
    status: deriveOmsStatus(order),
    channel: "medusa",
    currency,
    subtotal,
    shipping_fee: shippingFee,
    grand_total: grandTotal,
    metadata: metadata ?? {},
    created_at:
      typeof order.created_at === "string"
        ? order.created_at
        : new Date().toISOString(),
    order_items: mapLineItems(order.items),
  };

  return {
    order: detail,
    shipments: mapShipments(metadata),
  };
}

export async function fetchMedusaOrderJson(
  orderId: string,
): Promise<Record<string, unknown> | null> {
  const qs = new URLSearchParams();
  qs.set(
    "fields",
    "id,metadata,display_id,status,currency_code,created_at,email,subtotal,total,shipping_total,payment_status,fulfillment_status,*items,*items.variant,*items.variant.product,*customer",
  );
  const res = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?${qs.toString()}`,
    { method: "GET" },
  );
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as unknown;
  const order = unwrapOrderPayload(json);
  return order;
}

export type MedusaPaymentSummary = {
  id: string;
  /** Amount in smallest currency unit (e.g. centavos). */
  amount: number;
  currency_code: string;
  captured_amount?: number;
  refunded_amount?: number;
};

function collectPaymentsFromOrderPayload(order: Record<string, unknown>): MedusaPaymentSummary[] {
  const out: MedusaPaymentSummary[] = [];
  const pushRaw = (p: Record<string, unknown>) => {
    const id = String(p.id ?? "");
    if (!id) return;
    const amt = Number(p.amount ?? 0);
    const cap = p.captured_amount != null ? Number(p.captured_amount) : undefined;
    const ref = p.refunded_amount != null ? Number(p.refunded_amount) : undefined;
    out.push({
      id,
      amount: Number.isFinite(amt) ? amt : 0,
      currency_code: String(p.currency_code ?? "PHP").toUpperCase(),
      captured_amount: cap,
      refunded_amount: ref,
    });
  };

  const collections = order.payment_collections ?? order.payment_collection;
  const list = Array.isArray(collections)
    ? collections
    : collections && typeof collections === "object"
      ? [collections]
      : [];
  for (const col of list) {
    const c = col as Record<string, unknown>;
    const payments = c.payments;
    if (!Array.isArray(payments)) continue;
    for (const p of payments) {
      if (p && typeof p === "object") {
        pushRaw(p as Record<string, unknown>);
      }
    }
  }
  return out;
}

export async function fetchMedusaOrderPaymentsForAdmin(
  orderId: string,
): Promise<MedusaPaymentSummary[]> {
  const qs = new URLSearchParams();
  qs.set(
    "fields",
    "id,payment_collections,*payment_collections.payments",
  );
  const res = await medusaAdminFetch(
    `/admin/orders/${encodeURIComponent(orderId)}?${qs.toString()}`,
    { method: "GET" },
  );
  if (!res.ok) {
    return [];
  }
  const json = (await res.json()) as unknown;
  const order = unwrapOrderPayload(json);
  if (!order) {
    return [];
  }
  return collectPaymentsFromOrderPayload(order);
}

export async function refundMedusaPayment(
  paymentId: string,
  amountMinor: number,
  note?: string,
): Promise<{ ok: boolean; error?: string; status: number }> {
  const body: Record<string, unknown> = { amount: amountMinor };
  if (note?.trim()) {
    body.note = note.trim();
  }
  const res = await medusaAdminFetch(
    `/admin/payments/${encodeURIComponent(paymentId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
  if (res.ok) {
    return { ok: true, status: res.status };
  }
  const text = await res.text().catch(() => "");
  return { ok: false, error: `${res.status} ${text}`, status: res.status };
}

export async function patchMedusaOrderMetadata(
  orderId: string,
  metadata: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const body = JSON.stringify({ metadata });
  let res = await medusaAdminFetch(`/admin/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    body,
  });
  if (!res.ok && (res.status === 404 || res.status === 405)) {
    res = await medusaAdminFetch(`/admin/orders/${encodeURIComponent(orderId)}`, {
      method: "POST",
      body,
    });
  }
  if (res.ok) {
    return { ok: true };
  }
  const text = await res.text().catch(() => "");
  return { ok: false, error: `${res.status} ${text}` };
}
