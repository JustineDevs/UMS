import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handleWishlistRequest } from "./wishlist.ts";
import type { WorkerDatabaseClient } from "./database.ts";

function env() {
  const queries: Array<{ role: string; text: string; values: readonly unknown[] }> = [];
  return {
    env: {
      JWT_SECRET: "test-secret",
      databaseFactory(role: "app" | "medusa"): WorkerDatabaseClient {
        return {
          async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
            queries.push({ role, text, values });
            if (role === "medusa" && text.includes("FROM public.customer")) return { rows: [{ id: "cus_1" }] as T[], rowCount: 1 };
            if (role === "medusa" && text.includes("FROM public.product")) return { rows: [{ id: "prod_1", handle: "canary", title: "Canary" }] as T[], rowCount: 1 };
            if (role === "app" && text.includes("SELECT medusa_product_id")) return { rows: [{ medusa_product_id: "prod_1", added_at: "now" }] as T[], rowCount: 1 };
            return { rows: [] as T[], rowCount: 1 };
          },
          async end() {},
        };
      },
    },
    queries,
  };
}

function token(): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "user_1", email: "buyer@example.com", exp: Math.floor(Date.now() / 1000) + 300 });
  const signature = createHmac("sha256", "test-secret").update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

test("wishlist requires the Supabase-authenticated identity", async () => {
  const response = await handleWishlistRequest(new Request("https://api.example.com/store/wishlist"), env().env);
  assert.equal(response.status, 401);
});

test("wishlist writes canonical Medusa product data instead of trusting client metadata", async () => {
  const fixture = env();
  const response = await handleWishlistRequest(
    new Request("https://api.example.com/store/wishlist", {
      method: "POST",
      headers: { Authorization: "Bearer invalid", "Content-Type": "application/json" },
      body: JSON.stringify({ medusaProductId: "prod_1", product_name: "forged" }),
    }),
    fixture.env,
  );
  assert.equal(response.status, 401);
  assert.equal(fixture.queries.length, 0);
});

test("wishlist preserves the contract shape after canonical product resolution", async () => {
  const fixture = env();
  const response = await handleWishlistRequest(
    new Request("https://api.example.com/store/wishlist", { headers: { Authorization: `Bearer ${token()}` } }),
    fixture.env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { items: [{ product_slug: "canary", product_name: "Canary", medusa_product_id: "prod_1", added_at: "now" }] });
  assert.ok(fixture.queries.some((query) => query.role === "app" && query.text.includes("FROM public.wishlists")));
});

test("wishlist POST sends only canonical product fields to APP storage", async () => {
  const fixture = env();
  const response = await handleWishlistRequest(
    new Request("https://api.example.com/store/wishlist", {
      method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ medusaProductId: "prod_1", product_name: "forged" }),
    }),
    fixture.env,
  );
  assert.equal(response.status, 200);
  const write = fixture.queries.find((query) => query.text.includes("INSERT INTO public.wishlists"));
  assert.ok(write);
  assert.deepEqual(write?.values.slice(1), ["canary", "Canary", "prod_1"]);
});
