export type CheckoutQuoteFingerprintInput = {
  currencyCode: string;
  subtotal: number;
  taxTotal: number;
  shippingTotal: number;
  discountTotal: number;
  total: number;
  lineSubtotalsByVariantId: Record<string, number>;
  variantIds?: string[];
  productIds?: string[];
  shippingMethodIds?: string[];
  regionId?: string | null;
};

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

function normalizeMoney(value: number): string {
  if (!Number.isFinite(value)) return "0.0000";
  return value.toFixed(4);
}

function sortedStrings(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))].sort();
}

function stableJson(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
  return `{${entries
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
    .join(",")}}`;
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildCheckoutQuoteFingerprint(
  input: CheckoutQuoteFingerprintInput,
): string {
  const normalizedLineSubtotals = Object.fromEntries(
    Object.entries(input.lineSubtotalsByVariantId)
      .filter(([variantId]) => variantId.trim().length > 0)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([variantId, subtotal]) => [variantId.trim(), normalizeMoney(subtotal)]),
  );

  const payload: JsonValue = {
    currencyCode: input.currencyCode.trim().toUpperCase(),
    subtotal: normalizeMoney(input.subtotal),
    taxTotal: normalizeMoney(input.taxTotal),
    shippingTotal: normalizeMoney(input.shippingTotal),
    discountTotal: normalizeMoney(input.discountTotal),
    total: normalizeMoney(input.total),
    variantIds: sortedStrings(input.variantIds),
    productIds: sortedStrings(input.productIds),
    shippingMethodIds: sortedStrings(input.shippingMethodIds),
    regionId: input.regionId?.trim() || null,
    lineSubtotalsByVariantId: normalizedLineSubtotals,
  };

  return `qf_${simpleHash(stableJson(payload))}`;
}
