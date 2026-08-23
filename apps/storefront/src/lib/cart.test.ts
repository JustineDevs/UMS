import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReconciledCartTotal,
  cartAvailabilityMessage,
  isCartCheckoutBlocked,
  mergeReconciledCartLines,
  normalizeCartLines,
  parseCartMergeResponse,
  parseCartQuantityInput,
  selectHydratedCart,
} from "./cart";
import type { CartLine } from "./cart";

test("cart hydration preserves a non-empty local add draft over stale server lines", () => {
  const makeLine = (quantity: number): CartLine => ({
    variantId: "v1",
    quantity,
    slug: "guitar",
    name: "Guitar",
    sku: "G-1",
    type: "Acoustic",
    finish: "Natural",
    price: 100,
  });
  const local = [makeLine(1)];
  const server = [makeLine(866)];
  assert.deepEqual(selectHydratedCart(local, server), local);
  assert.deepEqual(selectHydratedCart([], server), server);
  assert.deepEqual(selectHydratedCart([], server, true), []);
});

test("parseCartQuantityInput preserves zero and rejects incomplete or unsafe input", () => {
  assert.equal(parseCartQuantityInput("0"), 0);
  assert.equal(parseCartQuantityInput("12"), 12);
  assert.equal(parseCartQuantityInput(""), null);
  assert.equal(parseCartQuantityInput("1e3"), null);
  assert.equal(parseCartQuantityInput("999999999999999999999"), null);
});

test("cart availability distinguishes unavailable variants from stock conflicts", () => {
  assert.equal(
    cartAvailabilityMessage(0),
    "This item is no longer available. Remove it before checkout.",
  );
  assert.equal(
    cartAvailabilityMessage(5),
    "Only 5 available. Reduce the quantity before checkout.",
  );
});

test("updateLineQuantity removes malformed quantities instead of persisting them", async () => {
  const { readCart, writeCart, updateLineQuantity, clearCart } = await import("./cart");
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } as unknown as Storage;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });

  const line: CartLine = {
    variantId: "malformed-quantity",
    quantity: 2,
    slug: "guitar",
    name: "Guitar",
    sku: "G-1",
    type: "Acoustic",
    finish: "Natural",
    price: 100,
  };
  writeCart([line]);
  updateLineQuantity(line.variantId, Number.NaN);
  assert.deepEqual(readCart(), []);

  clearCart();
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
});

test("duplicate add semantics add one requested unit, never available stock", async () => {
  const { addCartLine, readCart, clearCart } = await import("./cart");
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } },
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: (globalThis.window as { localStorage: Storage }).localStorage,
  });
  const line = {
    variantId: "v1", quantity: 1, slug: "guitar", name: "Guitar", sku: "G-1",
    type: "Acoustic", finish: "Natural", price: 100,
  };
  addCartLine(line);
  addCartLine(line);
  assert.equal(readCart()[0]?.quantity, 2);
  clearCart();
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
});

test("cart storage migrates legacy arrays and increments revisions", async () => {
  const { CART_STORAGE_KEY, readCart, readCartRevision, writeCart, clearCart } = await import("./cart");
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } as unknown as Storage;
  const events: Event[] = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage, dispatchEvent: (event: Event) => (events.push(event), true) },
  });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });

  storage.set(CART_STORAGE_KEY, JSON.stringify([{ variantId: "v1", quantity: 1 }]));
  assert.equal(readCart()[0]?.variantId, "v1");
  assert.equal(readCartRevision(), 1);
  writeCart([]);
  assert.equal(readCartRevision(), 2);
  assert.equal(events.some((event) => event.type === "ums-cart-updated"), true);
  assert.deepEqual(readCart(), []);

  clearCart();
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
});

test("wishlist-style add keeps the latest catalog metadata while adding one unit", async () => {
  const { addCartLine, readCart, clearCart } = await import("./cart");
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const storage = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } as unknown as Storage;
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorage });

  addCartLine({
    variantId: "wishlist-v1",
    quantity: 1,
    slug: "guitar",
    name: "Guitar",
    sku: "OLD",
    type: "",
    finish: "",
    price: 100,
  });
  addCartLine({
    variantId: "wishlist-v1",
    quantity: 1,
    slug: "guitar",
    name: "Guitar",
    sku: "NEW",
    type: "",
    finish: "Natural",
    price: 125,
    currencyCode: "PHP",
  });

  const line = readCart()[0];
  assert.equal(line?.quantity, 2);
  assert.equal(line?.price, 125);
  assert.equal(line?.sku, "NEW");
  assert.equal(line?.currencyCode, "PHP");
  clearCart();
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalStorage });
});

test("normalizeCartLines drops malformed rows and normalizes values", () => {
  const lines = normalizeCartLines([
    null,
    { variantId: "   ", quantity: 1 },
    {
      variantId: " variant_1 ",
      quantity: 2.9,
      slug: " guitar ",
      name: " Universal Guitar ",
      sku: " SKU-1 ",
      type: " M ",
      finish: " Black ",
      price: 300,
    },
  ]);

  assert.deepEqual(lines, [
    {
      variantId: "variant_1",
      quantity: 2,
      slug: "guitar",
      name: "Universal Guitar",
      sku: "SKU-1",
      type: "M",
      finish: "Black",
      price: 300,
    },
  ]);
});

test("normalizeCartLines merges duplicate variants into one normalized line", () => {
  const lines = normalizeCartLines([
    {
      variantId: "variant_1",
      quantity: 1,
      slug: "guitar",
      name: "Universal Guitar",
      sku: "SKU-1",
      type: "M",
      finish: "Black",
      price: 100,
    },
    {
      variantId: " variant_1 ",
      quantity: 3,
      slug: "guitar-v2",
      name: "Universal Guitar 2",
      sku: "SKU-1B",
      type: "L",
      finish: "Gray",
      price: 125,
    },
  ]);

  assert.deepEqual(lines, [
    {
      variantId: "variant_1",
      quantity: 4,
      slug: "guitar-v2",
      name: "Universal Guitar 2",
      sku: "SKU-1B",
      type: "L",
      finish: "Gray",
      price: 125,
    },
  ]);
});

test("cart currency is normalized and survives catalog reconciliation", () => {
  const current = normalizeCartLines([{
    variantId: "v1",
    quantity: 1,
    slug: "guitar",
    name: "Guitar",
    sku: "G-1",
    type: "Acoustic",
    finish: "Natural",
    price: 100,
    currencyCode: "jpy",
  }]);
  assert.equal(current[0]?.currencyCode, "JPY");
  const merged = mergeReconciledCartLines(current, [{
    variantId: "v1",
    quantity: 1,
    price: 110,
    currencyCode: "usd",
    status: "current",
  }]);
  assert.equal(merged[0]?.currencyCode, "USD");
});

test("mergeReconciledCartLines preserves unavailable lines instead of deleting the bag", () => {
  const current = [{
    variantId: "v1",
    quantity: 2,
    slug: "guitar",
    name: "Guitar",
    sku: "G-1",
    type: "Acoustic",
    finish: "Natural",
    price: 100,
  }];
  const merged = mergeReconciledCartLines(current, [{ variantId: "v1", status: "unavailable" }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.quantity, 2);
  assert.equal(merged[0]?.availableQuantity, 0);
});

test("calculateReconciledCartTotal excludes unavailable lines and uses catalog prices", () => {
  assert.equal(
    calculateReconciledCartTotal([
      { variantId: "v1", price: 1250, quantity: 2, status: "current" },
      { variantId: "v2", price: 900, quantity: 1, status: "unavailable" },
    ]),
    2500,
  );
});

test("cart checkout stays blocked until reconciliation is authoritative", () => {
  assert.equal(
    isCartCheckoutBlocked({
      reconciling: false,
      hasStockConflict: false,
      reconcileError: null,
      authoritativeTotal: null,
    }),
    true,
  );
  assert.equal(
    isCartCheckoutBlocked({
      reconciling: false,
      hasStockConflict: false,
      reconcileError: null,
      authoritativeTotal: 123,
    }),
    false,
  );
});

test("parseCartMergeResponse accepts a successful empty merge and rejects failures", () => {
  assert.deepEqual(parseCartMergeResponse(true, []), []);
  assert.equal(parseCartMergeResponse(false, []), null);
  assert.equal(parseCartMergeResponse(true, undefined), null);
});
