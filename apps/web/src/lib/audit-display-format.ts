/**
 * Plain-language labels for staff audit timelines (avoid internal ids and codes in the main UI).
 */

const ACTION_LABELS: Record<string, string> = {
  "catalog.product.create": "Added a product to the catalog",
  "catalog.product.update": "Updated a product",
  "catalog.product.delete": "Removed a product",
};

export function formatAuditActionLabel(action: string): string {
  const key = action.trim();
  if (ACTION_LABELS[key]) return ACTION_LABELS[key];
  return key
    .replace(/\./g, " ")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Maps stored resource keys (e.g. `product:prod_01…`) to a short, non-technical phrase.
 * Internal ids stay in the database; the timeline does not surface them by default.
 */
export function formatAuditResourceLabel(resource: string | null): string {
  if (!resource?.trim()) return "";
  const r = resource.trim().toLowerCase();
  if (r.startsWith("product:")) {
    return "Product in your catalog";
  }
  if (r.startsWith("order:")) {
    return "Order";
  }
  if (r.startsWith("customer:") || r.startsWith("user:")) {
    return "Customer or account";
  }
  if (r.startsWith("payment:") || r.includes("payment_connection")) {
    return "Payment settings";
  }
  return "Back office record";
}
