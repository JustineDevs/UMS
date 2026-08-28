import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAccountOrdersQuery,
  accountOrderMatchesCustomer,
  accountOrderMatchesIdentity,
  accountOrderMatchesHistory,
  countAccountOrderItems,
  computeAccountOrderStats,
  getAccountOrderViewState,
  normalizeAccountEmail,
  type AccountOrder,
} from "./medusa-account-orders";

const order = (currency: string, total: number): AccountOrder => ({
  id: `${currency}-${total}`,
  displayId: "1",
  status: "completed",
  total,
  currency,
  createdAt: "2026-08-22T00:00:00.000Z",
  itemCount: 1,
});

test("account stats aggregate a single currency", () => {
  assert.deepEqual(computeAccountOrderStats([order("PHP", 100), order("PHP", 50)]), {
    orderCount: 2,
    lifetimeSpend: 150,
    averageOrderValue: 75,
    currency: "PHP",
  });
});

test("account email normalization trims and lowercases before lookup", () => {
  assert.equal(normalizeAccountEmail("  Buyer@Example.COM "), "buyer@example.com");
});

test("account stats do not add unlike currencies", () => {
  assert.deepEqual(computeAccountOrderStats([order("PHP", 100), order("USD", 50)]), {
    orderCount: 2,
    lifetimeSpend: null,
    averageOrderValue: null,
    currency: null,
  });
});

test("account order query prefers canonical customer ownership over email", () => {
  const canonical = new URL(
    `https://store.test${buildAccountOrdersQuery("buyer@example.com", "cus_123", 100)}`,
  );
  assert.equal(canonical.searchParams.get("customer_id"), "cus_123");
  assert.equal(canonical.searchParams.get("email"), null);

  const legacy = new URL(
    `https://store.test${buildAccountOrdersQuery(" Buyer@Example.com ", null, 0)}`,
  );
  assert.equal(legacy.searchParams.get("email"), "buyer@example.com");
  assert.equal(legacy.searchParams.get("customer_id"), null);
});

test("account order item count reports units instead of line count", () => {
  assert.equal(countAccountOrderItems([{ quantity: 2 }, { quantity: 3 }]), 5);
  assert.equal(countAccountOrderItems([{ quantity: "3" }, { quantity: -2 }]), 0);
});

test("account order detail requires the canonical customer id", () => {
  assert.equal(accountOrderMatchesCustomer("cus_123", "cus_123"), true);
  assert.equal(accountOrderMatchesCustomer("cus_other", "cus_123"), false);
  assert.equal(accountOrderMatchesCustomer(null, "cus_123"), false);
});

test("account history accepts an exact email when a legacy order has no customer id", () => {
  assert.equal(accountOrderMatchesIdentity(null, "buyer@example.com", null, "buyer@example.com"), true);
  assert.equal(accountOrderMatchesIdentity("cus_other", "other@example.com", "cus_123", "buyer@example.com"), false);
});

test("account history requires canonical ownership when a customer id exists", () => {
  assert.equal(accountOrderMatchesIdentity("cus_other", "buyer@example.com", "cus_123", "buyer@example.com"), false);
  assert.equal(accountOrderMatchesIdentity("cus_123", "other@example.com", "cus_123", "buyer@example.com"), true);
});

test("account history keeps an exact-email legacy order when customer lookup is canonical", () => {
  assert.equal(
    accountOrderMatchesHistory(
      { id: "order_legacy", customer_id: null, email: "buyer@example.com" },
      "cus_123",
      "buyer@example.com",
      new Set(["order_legacy"]),
    ),
    true,
  );
  assert.equal(
    accountOrderMatchesHistory(
      { id: "order_other", customer_id: null, email: "buyer@example.com" },
      "cus_123",
      "buyer@example.com",
      new Set(),
    ),
    false,
  );
});

test("account order view distinguishes signed out, loading, unavailable, empty, and ready", () => {
  const base = { authenticated: true, loading: false, error: null, orderCount: 0 };
  assert.equal(getAccountOrderViewState({ ...base, authenticated: false }), "signed_out");
  assert.equal(getAccountOrderViewState({ ...base, loading: true }), "loading");
  assert.equal(getAccountOrderViewState({ ...base, error: "unavailable" }), "error");
  assert.equal(getAccountOrderViewState(base), "empty");
  assert.equal(getAccountOrderViewState({ ...base, orderCount: 1 }), "ready");
});
