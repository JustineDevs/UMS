export type CanonicalReceiptOrder = {
  id: string;
  display_id: string;
  customer_email: string | null;
  items: Array<{ title: string; quantity: number; unit_price: number }>;
  total: number;
  currency_code: string;
  created_at?: string;
};

function finiteMinor(value: unknown): number {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
}

function nonEmpty(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

/** Converts a Medusa order response into receipt data. Client receipt fields never enter this function. */
export function canonicalReceiptOrderFromMedusa(
  order: Record<string, unknown>,
): CanonicalReceiptOrder {
  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.map((raw) => {
    const item = (raw && typeof raw === "object" ? raw : {}) as Record<
      string,
      unknown
    >;
    const variant = (
      item.variant && typeof item.variant === "object" ? item.variant : {}
    ) as Record<string, unknown>;
    const product = (
      variant.product && typeof variant.product === "object"
        ? variant.product
        : {}
    ) as Record<string, unknown>;
    const title = nonEmpty(
      item.title ??
        item.product_title ??
        product.title ??
        variant.title ??
        item.variant_id,
      "Item",
    );
    const quantity = Math.max(1, Math.floor(Number(item.quantity ?? 1)) || 1);
    return {
      title,
      quantity,
      unit_price: finiteMinor(
        item.unit_price ?? item.unit_price_incl_tax ?? item.original_unit_price,
      ),
    };
  });

  return {
    id: nonEmpty(order.id, ""),
    display_id: nonEmpty(order.display_id, nonEmpty(order.id, "order")),
    customer_email:
      typeof order.email === "string" && order.email.includes("@")
        ? order.email.trim()
        : null,
    items,
    total: finiteMinor(order.total),
    currency_code: nonEmpty(order.currency_code, "PHP").toUpperCase(),
    created_at:
      typeof order.created_at === "string" ? order.created_at : undefined,
  };
}
