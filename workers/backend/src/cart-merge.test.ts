import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleCartMergeRequest } from "./cart-merge.ts";
import { handleBackendRequest, type BackendEnv } from "./router.ts";

const secret = "cart-merge-test-secret";

function token(email = "buyer@example.com"): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "user-123",
    email,
    scope: "storefront:cart-merge",
    iss: "uvs.internal",
    aud: "uvs-worker",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const input = `${header}.${payload}`;
  const signature = createHmac("sha256", secret).update(input).digest("base64url");
  return `${input}.${signature}`;
}

function request(body: unknown, authorization = `Bearer ${token()}`): Request {
  return new Request("https://api.test/store/cart/merge", {
    method: "POST",
    headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function env(appQuery: WorkerDatabaseClient["query"], commerceQuery: WorkerDatabaseClient["query"]) {
  const touched: string[] = [];
  const databaseFactory = (role: "app" | "medusa"): WorkerDatabaseClient => ({
    async query<Row>(sql: string, values: readonly unknown[] = []) {
      touched.push(`${role}:${sql.trim().split(/\s+/).slice(0, 4).join(" ")}`);
      const query = role === "app" ? appQuery : commerceQuery;
      return query<Row>(sql, values);
    },
    async end() {},
  });
  return { env: { JWT_SECRET: secret, databaseFactory }, touched };
}

test("cart merge rejects a missing or invalid user token before database access", async () => {
  const fixture = env(async () => ({ rows: [], rowCount: 0 }), async () => ({ rows: [], rowCount: 0 }));
  const response = await handleCartMergeRequest(
    request({ cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }] }, ""),
    fixture.env,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(fixture.touched, []);
});

test("Worker router mounts the cart-merge contract behind the authenticated handler", async () => {
  const calls: string[] = [];
  const environment = {
    APP_DB_URL: "postgres://app.invalid/unused",
    MEDUSA_DB_URL: "postgres://commerce.invalid/unused",
    JWT_SECRET: secret,
    databaseFactory: (role: "app" | "medusa"): WorkerDatabaseClient => ({
      async query<Row>(sql: string) {
        calls.push(`${role}:${sql}`);
        return { rows: [] as Row[], rowCount: 0 };
      },
      async end() {},
    }),
  } as unknown as BackendEnv;
  const response = await handleBackendRequest(
    new Request("https://api.test/store/cart/merge", { method: "POST", body: "{}" }),
    environment,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(calls, []);
});

test("cart merge refuses a cart owned by a different account and releases its claim", async () => {
  const appCalls: string[] = [];
  const fixture = env(
    async <Row>(sql: string) => {
      appCalls.push(sql);
      if (sql.includes("claim_cart_merge")) return { rows: [{ acquired: true, replayed: false, response: null }] as Row[], rowCount: 1 };
      return { rows: [{ release_cart_merge: true }] as Row[], rowCount: 1 };
    },
    async <Row>(sql: string) => sql.includes("SELECT id, email, currency_code")
      ? { rows: [{ id: "cart_1234", email: "other@example.com", currency_code: "php", metadata: {} }] as Row[], rowCount: 1 }
      : { rows: [], rowCount: 0 },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }), fixture.env);
  assert.equal(response.status, 403);
  assert.equal((await response.json() as { error: string }).error, "cart_owner_mismatch");
  assert.ok(appCalls.some((sql) => sql.includes("release_cart_merge")));
});

test("completed merge requests authorize the cart owner before replaying the durable APP result", async () => {
  let commerceOpened = false;
  const fixture = env(
    async <Row>() => ({ rows: [{ acquired: false, replayed: true, response: { ok: true, cartId: "cart_1234", lines: [] } }] as Row[], rowCount: 1 }),
    async <Row>(sql: string) => {
      commerceOpened = true;
      return sql.includes("SELECT id, email FROM public.cart")
        ? { rows: [{ id: "cart_1234", email: "buyer@example.com" }] as Row[], rowCount: 1 }
        : { rows: [] as Row[], rowCount: 0 };
    },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, cartId: "cart_1234", lines: [], replayed: true });
  assert.equal(commerceOpened, true);
});

test("cart merge does not disclose a completed replay to another signed-in account", async () => {
  const fixture = env(
    async <Row>() => ({ rows: [{ acquired: false, replayed: true, response: { ok: true, cartId: "cart_1234", lines: [{ name: "Private cart item" }] } }] as Row[], rowCount: 1 }),
    async <Row>(sql: string) => sql.includes("SELECT id, email FROM public.cart")
      ? { rows: [{ id: "cart_1234", email: "buyer@example.com" }] as Row[], rowCount: 1 }
      : { rows: [] as Row[], rowCount: 0 },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }, `Bearer ${token("attacker@example.com")}`), fixture.env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "cart_owner_mismatch" });
});

test("cart merge refuses replay when the persisted cart has no authenticated owner", async () => {
  const fixture = env(
    async <Row>() => ({ rows: [{ acquired: false, replayed: true, response: { ok: true, cartId: "cart_1234", lines: [{ name: "Private cart item" }] } }] as Row[], rowCount: 1 }),
    async <Row>(sql: string) => sql.includes("SELECT id, email FROM public.cart")
      ? { rows: [{ id: "cart_1234", email: null }] as Row[], rowCount: 1 }
      : { rows: [] as Row[], rowCount: 0 },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }), fixture.env);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "cart_owner_mismatch" });
});

test("cart merge applies duplicate guest variants in one commerce transaction and records replay response", async () => {
  const appCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const commerceCalls: Array<{ sql: string; values: readonly unknown[] }> = [];
  const fixture = env(
    async <Row>(sql: string, values: readonly unknown[] = []) => {
      appCalls.push({ sql, values });
      if (sql.includes("claim_cart_merge")) return { rows: [{ acquired: true, replayed: false, response: null }] as Row[], rowCount: 1 };
      if (sql.includes("complete_cart_merge")) return { rows: [{ complete_cart_merge: true }] as Row[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async <Row>(sql: string, values: readonly unknown[] = []) => {
      commerceCalls.push({ sql, values });
      if (sql.includes("SELECT id, email, currency_code")) return { rows: [{ id: "cart_1234", email: null, currency_code: "php", metadata: {} }] as Row[], rowCount: 1 };
      if (sql.includes("SELECT id, variant_id, quantity")) return { rows: [] as Row[], rowCount: 0 };
      if (sql.includes("SELECT p.id AS product_id")) return { rows: [{
        product_id: "prod_1234", product_title: "Canary", product_handle: "canary", product_description: null,
        thumbnail: "/canary.jpg", variant_id: "variant_1234", variant_title: "Default", variant_sku: "GTR-1",
        allow_backorder: false, unit_price: 599700, available_quantity: 3,
      }] as Row[], rowCount: 1 };
      if (sql.includes("SELECT i.variant_id, i.quantity")) return { rows: [{
        variant_id: "variant_1234", quantity: 3, slug: "canary", name: "Canary", sku: "GTR-1", unit_price: 599700,
        thumbnail: "/canary.jpg", currency_code: "php",
      }] as Row[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [
      { variantId: "variant_1234", quantity: 1 }, { variantId: "variant_1234", quantity: 2 },
    ],
  }), fixture.env);
  assert.equal(response.status, 200);
  const payload = await response.json() as { cartId: string; lines: Array<{ quantity: number; price: number }> };
  assert.equal(payload.cartId, "cart_1234");
  assert.deepEqual(payload.lines.map(({ quantity, price }) => ({ quantity, price })), [{ quantity: 3, price: 5997 }]);
  const insert = commerceCalls.find(({ sql }) => sql.includes("INSERT INTO public.cart_line_item"));
  assert.ok(insert);
  assert.equal(insert.values[4], 3);
  assert.ok(commerceCalls.some(({ sql }) => sql === "BEGIN"));
  assert.ok(commerceCalls.some(({ sql }) => sql === "COMMIT"));
  assert.ok(appCalls.some(({ sql, values }) => sql.includes("complete_cart_merge") && String(values[3]).includes("canary")));
});

test("cart merge recovers after commerce commit when APP completion is temporarily unavailable", async () => {
  let claimCount = 0;
  let completionCount = 0;
  let inserted = false;
  let mergedKey: string | undefined;
  const appCalls: string[] = [];
  const commerceCalls: string[] = [];
  const fixture = env(
    async <Row>(sql: string) => {
      appCalls.push(sql);
      if (sql.includes("claim_cart_merge")) {
        claimCount += 1;
        return { rows: [{ acquired: true, replayed: false, response: null }] as Row[], rowCount: 1 };
      }
      if (sql.includes("complete_cart_merge")) {
        completionCount += 1;
        return { rows: [{ complete_cart_merge: completionCount > 1 }] as Row[], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    async <Row>(sql: string, values: readonly unknown[] = []) => {
      commerceCalls.push(sql);
      if (sql.includes("SELECT id, email, currency_code"))
        return { rows: [{ id: "cart_1234", email: null, currency_code: "php", metadata: mergedKey ? { storefront_guest_merge_key: mergedKey } : {} }] as Row[], rowCount: 1 };
      if (sql.includes("SELECT id, variant_id, quantity"))
        return { rows: inserted ? [{ id: "line_1234", variant_id: "variant_1234", quantity: 1 }] as Row[] : [] as Row[], rowCount: Number(inserted) };
      if (sql.includes("SELECT p.id AS product_id")) return { rows: [{
        product_id: "prod_1234", product_title: "Canary", product_handle: "canary", variant_id: "variant_1234",
        variant_title: "Default", variant_sku: "GTR-1", allow_backorder: false, unit_price: 599700,
        available_quantity: 3,
      }] as Row[], rowCount: 1 };
      if (sql.includes("INSERT INTO public.cart_line_item")) inserted = true;
      if (sql.includes("UPDATE public.cart SET email")) mergedKey = JSON.parse(String(values[2])).storefront_guest_merge_key;
      if (sql.includes("SELECT i.variant_id, i.quantity")) return { rows: [{
        variant_id: "variant_1234", quantity: 1, slug: "canary", name: "Canary", sku: "GTR-1", unit_price: 599700,
        thumbnail: "/canary.jpg", currency_code: "php",
      }] as Row[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
  );

  const first = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }), fixture.env);
  assert.equal(first.status, 503);
  assert.equal(inserted, true);

  const retry = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [{ variantId: "variant_1234", quantity: 1 }],
  }), fixture.env);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), {
    ok: true,
    cartId: "cart_1234",
    lines: [{
      variantId: "variant_1234", quantity: 1, slug: "canary", name: "Canary", sku: "GTR-1", type: "", finish: "",
      price: 5997, currencyCode: "PHP", thumbnail: "/canary.jpg",
    }],
    replayed: true,
  });
  assert.equal(claimCount, 2);
  assert.equal(completionCount, 2);
  assert.equal(commerceCalls.filter((sql) => sql.includes("INSERT INTO public.cart_line_item")).length, 1);
  assert.equal(commerceCalls.filter((sql) => sql === "COMMIT").length, 2);
  assert.equal(commerceCalls.filter((sql) => sql === "BEGIN").length, 2);
  assert.ok(!appCalls.some((sql) => sql.includes("release_cart_merge")));
});

test("cart merge refuses insufficient stock and rolls back without recording completion", async () => {
  const appCalls: string[] = [];
  const commerceCalls: string[] = [];
  const fixture = env(
    async <Row>(sql: string) => {
      appCalls.push(sql);
      if (sql.includes("claim_cart_merge")) return { rows: [{ acquired: true, replayed: false, response: null }] as Row[], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    },
    async <Row>(sql: string, values: readonly unknown[] = []) => {
      commerceCalls.push(sql);
      if (sql.includes("SELECT id, email, currency_code")) return { rows: [{ id: "cart_1234", email: null, currency_code: "php", metadata: {} }] as Row[], rowCount: 1 };
      if (sql.includes("SELECT p.id AS product_id")) return { rows: [{
        product_id: "prod_1234", product_title: "Canary", product_handle: "canary", variant_id: values[0],
        variant_title: "Default", variant_sku: "GTR-1", allow_backorder: false, unit_price: 599700,
        available_quantity: values[0] === "variant_1234" ? 1 : 0,
      }] as Row[], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  );
  const response = await handleCartMergeRequest(request({
    cartId: "cart_1234", mergeKey: "guest-merge-key-1234", guestLines: [
      { variantId: "variant_1234", quantity: 1 }, { variantId: "variant_5678", quantity: 1 },
    ],
  }), fixture.env);
  assert.equal(response.status, 409);
  assert.equal((await response.json() as { error: string }).error, "insufficient_stock");
  assert.ok(commerceCalls.includes("ROLLBACK"));
  assert.ok(!commerceCalls.some((sql) => sql.includes("INSERT INTO public.cart_line_item")));
  assert.ok(appCalls.some((sql) => sql.includes("release_cart_merge")));
  assert.ok(!appCalls.some((sql) => sql.includes("complete_cart_merge")));
});
