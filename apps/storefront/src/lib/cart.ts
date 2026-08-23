export type CartLine = {
  variantId: string;
  quantity: number;
  slug: string;
  name: string;
  sku: string;
  type: string;
  finish: string;
  price: number;
  /** ISO currency code for the displayed price. */
  currencyCode?: string;
  /** Product thumbnail URL for checkout display. */
  thumbnail?: string;
  /** Latest catalog stock snapshot; never replaces the requested quantity. */
  availableQuantity?: number | null;
};

/** Accept only a successful, complete merge response; an empty array is valid. */
export function parseCartMergeResponse(
  ok: boolean,
  lines: unknown,
): CartLine[] | null {
  return ok && Array.isArray(lines) ? normalizeCartLines(lines) : null;
}

export type ReconciledCartLine = Partial<CartLine> & {
  variantId: string;
  status?: string;
};

export function calculateReconciledCartTotal(lines: ReconciledCartLine[]): number {
  return lines
    .filter((line) => line.status !== "unavailable")
    .reduce(
      (total, line) => total + (line.price ?? 0) * (line.quantity ?? 0),
      0,
    );
}

export function isCartCheckoutBlocked(input: {
  reconciling: boolean;
  hasStockConflict: boolean;
  reconcileError: string | null;
  authoritativeTotal: number | null;
}): boolean {
  return (
    input.reconciling ||
    input.hasStockConflict ||
    Boolean(input.reconcileError) ||
    input.authoritativeTotal === null
  );
}

export function cartAvailabilityMessage(availableQuantity: number): string {
  return availableQuantity === 0
    ? "This item is no longer available. Remove it before checkout."
    : `Only ${availableQuantity} available. Reduce the quantity before checkout.`;
}

export function parseCartQuantityInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const quantity = Number(normalized);
  return Number.isSafeInteger(quantity) ? quantity : null;
}

/** Browser-only bag until checkout builds a Medusa cart; line prices here are for display. */
// v4 intentionally invalidates v3 quantities created by the old stock-max bug.
export const CART_STORAGE_KEY = "ums-commerce-cart-v4";
export const CART_UPDATED_EVENT = "ums-cart-updated";
const CART_MERGE_KEY = "ums-commerce-cart-merge-v1";
const CART_STORAGE_VERSION = 1;

type CartStorageEnvelope = {
  version: typeof CART_STORAGE_VERSION;
  revision: number;
  updatedAt: number;
  lines: unknown;
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notifyCartUpdated(): void {
  if (typeof window?.dispatchEvent !== "function") return;
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

function normalizeCartLine(line: unknown): CartLine | null {
  if (!line || typeof line !== "object") return null;
  const row = line as Partial<CartLine>;
  const variantId = typeof row.variantId === "string" ? row.variantId.trim() : "";
  const quantity =
    typeof row.quantity === "number" && Number.isFinite(row.quantity)
      ? Math.floor(row.quantity)
      : 0;
  if (!variantId || quantity < 1) return null;
  const thumb = typeof row.thumbnail === "string" && row.thumbnail.trim()
    ? row.thumbnail.trim()
    : undefined;
  const currencyCode = typeof row.currencyCode === "string" && row.currencyCode.trim()
    ? row.currencyCode.trim().toUpperCase()
    : undefined;
  const availableQuantity =
    typeof row.availableQuantity === "number" && Number.isFinite(row.availableQuantity)
      ? Math.max(0, Math.floor(row.availableQuantity))
      : null;
  const hasAvailableQuantity = Object.prototype.hasOwnProperty.call(
    row,
    "availableQuantity",
  );
  return {
    variantId,
    quantity,
    slug: typeof row.slug === "string" ? row.slug.trim() : "",
    name: typeof row.name === "string" ? row.name.trim() : "",
    sku: typeof row.sku === "string" ? row.sku.trim() : "",
    type: typeof row.type === "string" ? row.type.trim() : "",
    finish: typeof row.finish === "string" ? row.finish.trim() : "",
    price:
      typeof row.price === "number" && Number.isFinite(row.price) ? row.price : 0,
    ...(currencyCode ? { currencyCode } : {}),
    ...(hasAvailableQuantity ? { availableQuantity } : {}),
    ...(thumb ? { thumbnail: thumb } : {}),
  };
}

export function normalizeCartLines(lines: unknown): CartLine[] {
  if (!Array.isArray(lines)) return [];
  const merged = new Map<string, CartLine>();
  for (const rawLine of lines) {
    const line = normalizeCartLine(rawLine);
    if (!line) continue;
    const current = merged.get(line.variantId);
    if (current) {
      merged.set(line.variantId, {
        ...line,
        quantity: current.quantity + line.quantity,
      });
      continue;
    }
    merged.set(line.variantId, line);
  }
  return [...merged.values()];
}

/** Keep a local add-to-bag draft from being replaced by a stale server cart during navigation. */
export function selectHydratedCart(
  localLines: CartLine[],
  serverLines: CartLine[],
  localChanged = false,
): CartLine[] {
  return localLines.length > 0 || localChanged ? localLines : serverLines;
}

/** Merge catalog truth without deleting lines when a read temporarily fails or stock changes. */
export function mergeReconciledCartLines(
  current: CartLine[],
  reconciled: ReconciledCartLine[],
): CartLine[] {
  const byVariant = new Map(reconciled.map((line) => [line.variantId, line]));
  return current.map((original) => {
    const line = byVariant.get(original.variantId);
    if (!line || line.status === "unavailable") {
      return { ...original, availableQuantity: 0 };
    }
    return {
      ...original,
      variantId: line.variantId,
      quantity: line.quantity ?? original.quantity,
      slug: line.slug ?? original.slug,
      name: line.name ?? original.name,
      sku: line.sku ?? original.sku,
      type: line.type ?? original.type,
      finish: line.finish ?? original.finish,
      price: line.price ?? original.price,
      ...(line.currencyCode ? { currencyCode: line.currencyCode.toUpperCase() } : {}),
      availableQuantity: line.availableQuantity ?? null,
      ...(line.thumbnail ? { thumbnail: line.thumbnail } : {}),
    };
  });
}

export function readCart(): CartLine[] {
  if (!isBrowser()) return [];
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
  const envelope = parseCartStorage(parsed);
  if (!envelope) {
    localStorage.removeItem(CART_STORAGE_KEY);
    return [];
  }
  const normalized = normalizeCartLines(envelope.lines);
  if (
    !isCartStorageEnvelope(parsed) ||
    normalized.length !== (Array.isArray(envelope.lines) ? envelope.lines.length : 0)
  ) {
    writeCart(normalized);
  }
  return normalized;
}

export function writeCart(lines: CartLine[]): void {
  if (!isBrowser()) return;
  const currentRaw = localStorage.getItem(CART_STORAGE_KEY);
  let revision = 0;
  if (currentRaw) {
    try {
      const current = parseCartStorage(JSON.parse(currentRaw));
      revision = current?.revision ?? 0;
    } catch {
      revision = 0;
    }
  }
  const next: CartStorageEnvelope = {
    version: CART_STORAGE_VERSION,
    revision: revision + 1,
    updatedAt: Date.now(),
    lines: normalizeCartLines(lines),
  };
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next));
  notifyCartUpdated();
}

export function readCartRevision(): number {
  if (!isBrowser()) return 0;
  const raw = localStorage.getItem(CART_STORAGE_KEY);
  if (!raw) return 0;
  try {
    return parseCartStorage(JSON.parse(raw))?.revision ?? 0;
  } catch {
    return 0;
  }
}

function isCartStorageEnvelope(value: unknown): value is CartStorageEnvelope {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      (value as CartStorageEnvelope).version === CART_STORAGE_VERSION &&
      Number.isSafeInteger((value as CartStorageEnvelope).revision) &&
      (value as CartStorageEnvelope).revision >= 0 &&
      Array.isArray((value as CartStorageEnvelope).lines),
  );
}

function parseCartStorage(value: unknown): { lines: unknown; revision: number } | null {
  if (Array.isArray(value)) return { lines: value, revision: 0 };
  if (!isCartStorageEnvelope(value)) return null;
  return { lines: value.lines, revision: value.revision };
}

export function getCartMergeKey(): string {
  if (!isBrowser()) return "";
  const current = localStorage.getItem(CART_MERGE_KEY)?.trim();
  if (current) return current;
  const next = crypto.randomUUID();
  localStorage.setItem(CART_MERGE_KEY, next);
  return next;
}

function rotateCartMergeKey(): void {
  if (!isBrowser()) return;
  localStorage.setItem(CART_MERGE_KEY, crypto.randomUUID());
}

export function addCartLine(line: CartLine): void {
  const cur = readCart();
  const normalizedLine = normalizeCartLine(line);
  if (!normalizedLine) return;
  const idx = cur.findIndex((c) => c.variantId === normalizedLine.variantId);
  if (idx >= 0) {
    cur[idx] = {
      ...normalizedLine,
      quantity: cur[idx].quantity + normalizedLine.quantity,
    };
  } else {
    cur.push(normalizedLine);
  }
  writeCart(cur);
  rotateCartMergeKey();
}

export function updateLineQuantity(variantId: string, quantity: number): void {
  const cur = readCart();
  const normalizedQuantity = Number.isSafeInteger(quantity) ? quantity : 0;
  if (normalizedQuantity <= 0) {
    writeCart(cur.filter((c) => c.variantId !== variantId));
    rotateCartMergeKey();
    return;
  }
  writeCart(
    cur.map((c) => (c.variantId === variantId ? { ...c, quantity: normalizedQuantity } : c)),
  );
  rotateCartMergeKey();
}

export function clearCart(): void {
  if (!isBrowser()) return;
  // Keep an empty revisioned envelope so in-flight server hydration cannot
  // resurrect a line the shopper deliberately removed.
  writeCart([]);
  localStorage.removeItem(CART_MERGE_KEY);
}
