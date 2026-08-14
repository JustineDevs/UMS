/**
 * Parse optional stock from catalog API JSON bodies (create/update product).
 */
export function parseOptionalStockQuantity(
  body: Record<string, unknown>,
): { ok: true; value: number | undefined } | { ok: false; error: string } {
  if (!("stockQuantity" in body)) return { ok: true, value: undefined };
  const raw = body.stockQuantity;
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: undefined };
  }
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) {
    return { ok: false, error: "Stock must be a non-negative whole number." };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: "Stock must be a whole number (no decimals)." };
  }
  return { ok: true, value: n };
}

export type ParsedVariantStockRow = { variantId: string; quantity: number };

/**
 * Optional per-variant stock overrides from PATCH bodies.
 */
export function parseOptionalVariantStocks(
  body: Record<string, unknown>,
):
  | { ok: true; value: ParsedVariantStockRow[] | undefined }
  | { ok: false; error: string } {
  if (!("variantStocks" in body)) return { ok: true, value: undefined };
  const raw = body.variantStocks;
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "variantStocks must be an array." };
  }
  const out: ParsedVariantStockRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `Invalid variantStocks entry at index ${i}.` };
    }
    const o = item as Record<string, unknown>;
    const variantId = typeof o.variantId === "string" ? o.variantId.trim() : "";
    if (!variantId) {
      return {
        ok: false,
        error: `variantStocks[${i}]: variantId is required.`,
      };
    }
    const qRaw = o.quantity;
    const n =
      typeof qRaw === "number" ? qRaw : Number(String(qRaw ?? "").trim());
    if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) {
      return {
        ok: false,
        error: `Stock for variant ${variantId} must be a non-negative whole number.`,
      };
    }
    if (!Number.isInteger(n)) {
      return {
        ok: false,
        error: `Stock for variant ${variantId} must be a whole number (no decimals).`,
      };
    }
    if (variantId.length > 200) {
      return {
        ok: false,
        error: `variantStocks[${i}]: variantId is too long.`,
      };
    }
    out.push({ variantId, quantity: n });
  }
  return { ok: true, value: out };
}

export type ParsedMatrixCellStockRow = {
  sizeLabel: string;
  colorLabel: string;
  quantity: number;
};

/**
 * Per size/color stock for matrix products (resolved to variant ids on the server after sync).
 */
export function parseOptionalMatrixCellStocks(
  body: Record<string, unknown>,
):
  | { ok: true; value: ParsedMatrixCellStockRow[] | undefined }
  | { ok: false; error: string } {
  if (!("matrixCellStocks" in body)) return { ok: true, value: undefined };
  const raw = body.matrixCellStocks;
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "matrixCellStocks must be an array." };
  }
  const out: ParsedMatrixCellStockRow[] = [];
  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      return {
        ok: false,
        error: `Invalid matrixCellStocks entry at index ${i}.`,
      };
    }
    const o = item as Record<string, unknown>;
    const sizeLabel = typeof o.sizeLabel === "string" ? o.sizeLabel.trim() : "";
    const colorLabel =
      typeof o.colorLabel === "string" ? o.colorLabel.trim() : "";
    if (!sizeLabel || !colorLabel) {
      return {
        ok: false,
        error: `matrixCellStocks[${i}]: sizeLabel and colorLabel are required.`,
      };
    }
    const qRaw = o.quantity;
    const n =
      typeof qRaw === "number" ? qRaw : Number(String(qRaw ?? "").trim());
    if (!Number.isSafeInteger(n) || n < 0 || n > 10_000_000) {
      return {
        ok: false,
        error: `matrixCellStocks[${i}]: quantity must be a non-negative whole number.`,
      };
    }
    if (!Number.isInteger(n)) {
      return {
        ok: false,
        error: `matrixCellStocks[${i}]: quantity must be a whole number.`,
      };
    }
    if (sizeLabel.length > 200 || colorLabel.length > 200) {
      return {
        ok: false,
        error: `matrixCellStocks[${i}]: option labels are too long.`,
      };
    }
    out.push({ sizeLabel, colorLabel, quantity: n });
  }
  return { ok: true, value: out };
}
