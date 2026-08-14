/**
 * Stress test: validation logic with mock data to capture edge cases and regressions.
 * Run: pnpm --filter @universal-music-store/validation test
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  isPhilippinesMobilePhone,
  productListQuerySchema,
  productListSortSchema,
  orderStatusSchema,
  storefrontCustomerProfilePatchSchema,
  storefrontShippingAddressSchema,
} from "./index";

// --- productListQuerySchema ---

test("productListQuerySchema: accepts valid minimal input", () => {
  const r = productListQuerySchema.safeParse({});
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data, {});
});

test("productListQuerySchema: accepts full valid input", () => {
  const input = {
    limit: 20,
    offset: 0,
    category: "Guitars",
    type: "Electric Guitar",
    finish: "Black",
    pickupConfig: "H-S-H",
    bodyWood: "Mahogany",
    condition: "New",
    skillLevel: "Intermediate",
    shippingSpeed: "Express",
    q: "polo",
    sort: "price_asc" as const,
  };
  const r = productListQuerySchema.safeParse(input);
  assert.equal(r.success, true);
  if (r.success) assert.deepEqual(r.data, input);
});

test("productListQuerySchema: coerces limit string to number", () => {
  const r = productListQuerySchema.safeParse({ limit: "10" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.limit, 10);
});

test("productListQuerySchema: coerces offset string to number", () => {
  const r = productListQuerySchema.safeParse({ offset: "100" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.offset, 100);
});

test("productListQuerySchema: rejects limit < 1", () => {
  const r = productListQuerySchema.safeParse({ limit: 0 });
  assert.equal(r.success, false);
});

test("productListQuerySchema: rejects limit > 100", () => {
  const r = productListQuerySchema.safeParse({ limit: 101 });
  assert.equal(r.success, false);
});

test("productListQuerySchema: rejects offset < 0", () => {
  const r = productListQuerySchema.safeParse({ offset: -1 });
  assert.equal(r.success, false);
});

test("productListQuerySchema: rejects offset > 50000", () => {
  const r = productListQuerySchema.safeParse({ offset: 50001 });
  assert.equal(r.success, false);
});

test("productListQuerySchema: trims category", () => {
  const r = productListQuerySchema.safeParse({ category: "  Guitars  " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.category, "Guitars");
});

test("productListQuerySchema: rejects category longer than 120 chars", () => {
  const r = productListQuerySchema.safeParse({
    category: "a".repeat(121),
  });
  assert.equal(r.success, false);
});

test("productListQuerySchema: rejects invalid sort", () => {
  const r = productListQuerySchema.safeParse({ sort: "invalid_sort" });
  assert.equal(r.success, false);
});

test("productListQuerySchema: accepts all valid sorts", () => {
  const sorts = ["newest", "name_asc", "price_asc", "price_desc"] as const;
  for (const sort of sorts) {
    const r = productListQuerySchema.safeParse({ sort });
    assert.equal(r.success, true, `sort="${sort}" should pass`);
    if (r.success) assert.equal(r.data.sort, sort);
  }
});

test("productListQuerySchema: q preprocess - array first element", () => {
  const r = productListQuerySchema.safeParse({ q: ["hello", "ignored"] });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.q, "hello");
});

test("productListQuerySchema: q preprocess - empty string becomes undefined", () => {
  const r = productListQuerySchema.safeParse({ q: "   " });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.q, undefined);
});

test("productListQuerySchema: q preprocess - null becomes undefined", () => {
  const r = productListQuerySchema.safeParse({ q: null });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.q, undefined);
});

test("productListQuerySchema: q truncated to 80 chars", () => {
  const long = "a".repeat(100);
  const r = productListQuerySchema.safeParse({ q: long });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.q?.length, 80);
});

test("productListQuerySchema: q 81 chars truncated to 80 by preprocess", () => {
  const r = productListQuerySchema.safeParse({ q: "a".repeat(81) });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.q?.length, 80);
});

test("productListQuerySchema: type max 80 chars", () => {
  const r = productListQuerySchema.safeParse({ type: "a".repeat(80) });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.type?.length, 80);
});

test("productListQuerySchema: type 81 chars rejected", () => {
  const r = productListQuerySchema.safeParse({ type: "a".repeat(81) });
  assert.equal(r.success, false);
});

test("productListQuerySchema: finish max 80 chars", () => {
  const r = productListQuerySchema.safeParse({ finish: "a".repeat(81) });
  assert.equal(r.success, false);
});

test("productListQuerySchema: keeps finite non-negative prices", () => {
  const r = productListQuerySchema.safeParse({
    minPrice: "120.5",
    maxPrice: 999,
  });
  assert.equal(r.success, true);
  if (r.success) {
    assert.equal(r.data.minPrice, 120.5);
    assert.equal(r.data.maxPrice, 999);
  }
});

test("productListQuerySchema: rejects invalid prices", () => {
  const r = productListQuerySchema.safeParse({
    minPrice: -1,
    maxPrice: "not-a-number",
  });
  assert.equal(r.success, false);
});

test("productListQuerySchema: limit float coerced to int", () => {
  const r = productListQuerySchema.safeParse({ limit: "10.7" });
  assert.equal(r.success, true);
  if (r.success) assert.equal(r.data.limit, 10);
});

test("productListQuerySchema: extra keys stripped (strict: false)", () => {
  const r = productListQuerySchema.safeParse({
    limit: 10,
    __proto__: {},
    injection: "<script>",
  });
  assert.equal(r.success, true);
  if (r.success) assert.equal("injection" in r.data, false);
});

// --- productListSortSchema ---

test("productListSortSchema: accepts valid values", () => {
  const valid = ["newest", "name_asc", "price_asc", "price_desc"];
  for (const v of valid) {
    const r = productListSortSchema.safeParse(v);
    assert.equal(r.success, true, `sort="${v}" should pass`);
  }
});

test("productListSortSchema: rejects invalid values", () => {
  const invalid = ["", "NEWEST", "price-asc", "desc", 123, null, undefined];
  for (const v of invalid) {
    const r = productListSortSchema.safeParse(v);
    assert.equal(r.success, false, `value=${JSON.stringify(v)} should fail`);
  }
});

// --- orderStatusSchema ---

test("orderStatusSchema: accepts all valid statuses", () => {
  const valid = [
    "draft",
    "pending_payment",
    "paid",
    "ready_to_ship",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
  ];
  for (const v of valid) {
    const r = orderStatusSchema.safeParse(v);
    assert.equal(r.success, true, `status="${v}" should pass`);
  }
});

test("orderStatusSchema: rejects invalid statuses", () => {
  const invalid = ["PENDING", "pending", "complete", "", "unknown", 1];
  for (const v of invalid) {
    const r = orderStatusSchema.safeParse(v);
    assert.equal(r.success, false, `value=${JSON.stringify(v)} should fail`);
  }
});

test("isPhilippinesMobilePhone: accepts supported local formats", () => {
  const valid = ["+639123456789", "639123456789", "09123456789", "9123456789"];
  for (const value of valid) {
    assert.equal(isPhilippinesMobilePhone(value), true, `${value} should pass`);
  }
});

test("isPhilippinesMobilePhone: ignores spaces and dashes", () => {
  assert.equal(isPhilippinesMobilePhone("+63 912-345-6789"), true);
});

test("storefrontShippingAddressSchema: rejects non-PH mobile numbers", () => {
  const r = storefrontShippingAddressSchema.safeParse({
    fullName: "Test User",
    phone: "+15551234567",
    line1: "123 Example Street",
    barangay: "Bel-Air",
    city: "Makati",
    province: "Metro Manila",
  });
  assert.equal(r.success, false);
});

test("storefrontShippingAddressSchema: requires barangay for PH", () => {
  const r = storefrontShippingAddressSchema.safeParse({
    fullName: "Test User",
    phone: "+639123456789",
    line1: "123 Example Street",
    city: "Makati",
    province: "Metro Manila",
    country: "PH",
  });
  assert.equal(r.success, false);
});

test("storefrontCustomerProfilePatchSchema: rejects invalid phone patch", () => {
  const r = storefrontCustomerProfilePatchSchema.safeParse({
    phone: "12345",
  });
  assert.equal(r.success, false);
});
