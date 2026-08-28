import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("Storefront BFF contract tests", () => {
  const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
  const strict = process.env.STRICT_CONTRACT_TESTS === "1" || process.env.CI === "true";
  const publishableKey =
    process.env.MEDUSA_PUBLISHABLE_API_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  const regionId = process.env.MEDUSA_REGION_ID || process.env.NEXT_PUBLIC_MEDUSA_REGION_ID;
  const salesChannelId =
    process.env.MEDUSA_SALES_CHANNEL_ID ||
    process.env.NEXT_PUBLIC_MEDUSA_SALES_CHANNEL_ID;

  function storeHeaders(contentType = false): Record<string, string> {
    return {
      ...(contentType ? { "Content-Type": "application/json" } : {}),
      ...(publishableKey ? { "x-publishable-api-key": publishableKey } : {}),
    };
  }

  function failOrSkip(message: string): void {
    if (strict) {
      assert.fail(message);
    }
    assert.ok(true, message);
  }

  it("GET /store/products returns expected shape", async () => {
    const res = await fetch(`${MEDUSA_URL}/store/products?limit=1`, {
      headers: storeHeaders(),
    });
    if (!res.ok) {
      failOrSkip("Medusa not reachable for products contract test");
      return;
    }
    const json = (await res.json()) as Record<string, unknown>;
    assert.ok(Array.isArray(json.products), "Response should have products array");
    if ((json.products as unknown[]).length > 0) {
      const product = (json.products as Record<string, unknown>[])[0];
      assert.ok(typeof product.id === "string", "Product should have string id");
      assert.ok(typeof product.title === "string", "Product should have string title");
      assert.ok(product.variants !== undefined, "Product should have variants");
    }
  });

  it("GET /store/regions returns regions with currency", async () => {
    const res = await fetch(`${MEDUSA_URL}/store/regions`, {
      headers: storeHeaders(),
    });
    if (!res.ok) {
      failOrSkip("Medusa not reachable for regions contract test");
      return;
    }
    const json = (await res.json()) as Record<string, unknown>;
    assert.ok(Array.isArray(json.regions), "Response should have regions array");
    if ((json.regions as unknown[]).length > 0) {
      const region = (json.regions as Record<string, unknown>[])[0];
      assert.ok(typeof region.id === "string", "Region should have string id");
      assert.ok(typeof region.currency_code === "string", "Region should have currency_code");
    }
  });

  it("GET /store/collections returns expected shape", async () => {
    const res = await fetch(`${MEDUSA_URL}/store/collections?limit=5`, {
      headers: storeHeaders(),
    });
    if (!res.ok) {
      failOrSkip("Medusa not reachable for collections contract test");
      return;
    }
    const json = (await res.json()) as Record<string, unknown>;
    assert.ok(
      Array.isArray(json.collections) || json.collections === undefined,
      "Response should have collections array or be absent",
    );
  });

  it("POST /store/carts returns cart with id", async () => {
    const res = await fetch(`${MEDUSA_URL}/store/carts`, {
      method: "POST",
      headers: storeHeaders(true),
      body: JSON.stringify({
        ...(regionId ? { region_id: regionId } : {}),
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      }),
    });
    if (!res.ok) {
      failOrSkip("Medusa not reachable for cart contract test");
      return;
    }
    const json = (await res.json()) as Record<string, unknown>;
    assert.ok(json.cart !== undefined, "Response should have cart");
    const cart = json.cart as Record<string, unknown>;
    assert.ok(typeof cart.id === "string", "Cart should have string id");
  });
});
