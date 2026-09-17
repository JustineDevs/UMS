import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleAdminCatalogProductsRequest,
  handleAdminCatalogProductRequest,
  handleAdminCatalogProductDeleteRequest,
  handleAdminCatalogCategoriesRequest,
  handleAdminInventoryRequest,
  handleAdminOrderDetailRequest,
  handleAdminOrdersRequest,
} from "./admin-commerce.ts";
import { handleAdminCatalogProductMutationRequest } from "./catalog-admin.ts";

const database = {
  query: async () => ({ rows: [], rowCount: 0 }),
  end: async () => undefined,
};

function encode(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function encodeBytes(value: Uint8Array): string {
  return btoa(String.fromCharCode(...value))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function staffToken(): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: "staff_1", role: "admin", exp: 2_000_000_000 });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = encodeBytes(new Uint8Array(await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  )));
  return `${header}.${payload}.${signature}`;
}

describe("Worker admin commerce contracts", () => {
  it("rejects order reads without a verified staff bearer token", async () => {
    const response = await handleAdminOrdersRequest(
      new Request("https://worker.test/api/admin/orders"),
      database,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("rejects inventory reads without a verified staff bearer token", async () => {
    const response = await handleAdminInventoryRequest(
      new Request("https://worker.test/api/admin/inventory"),
      database,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("rejects order detail reads without a verified staff bearer token", async () => {
    const response = await handleAdminOrderDetailRequest(
      new Request("https://worker.test/api/admin/orders/order_1"),
      database,
      { JWT_SECRET: "test-secret" },
      "order_1",
    );
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  });

  it("does not allow mutation methods on read-only admin contracts", async () => {
    const response = await handleAdminOrdersRequest(
      new Request("https://worker.test/api/admin/orders", { method: "POST" }),
      database,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 405);
  });

  it("maps Worker order items to the admin snapshot contract", async () => {
    const orderDatabase = {
      query: async () => ({
        rows: [{
          id: "order_1",
          display_id: 149,
          customer_id: "customer_1",
          email: "customer@example.test",
          status: "pending",
          currency_code: "php",
          total: 599700,
          subtotal: 599700,
          shipping_total: 0,
          created_at: "2026-09-17T00:00:00.000Z",
          metadata: {},
          items: [{
            id: "item_1",
            product_name_snapshot: "Canary",
            sku_snapshot: "GUITAR-ACO-WHITE",
            size_snapshot: "",
            color_snapshot: "White",
            unit_price: 599700,
            quantity: 1,
            line_total: 599700,
          }],
          payments: [],
        }],
        rowCount: 1,
      }),
      end: async () => undefined,
    };
    const response = await handleAdminOrderDetailRequest(
      new Request("https://worker.test/api/admin/orders/order_1", {
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      orderDatabase,
      { JWT_SECRET: "test-secret" },
      "order_1",
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { order: { order_items: Array<Record<string, unknown>> } };
    assert.deepEqual(body.order.order_items[0], {
      id: "item_1",
      sku_snapshot: "GUITAR-ACO-WHITE",
      product_name_snapshot: "Canary",
      size_snapshot: "",
      color_snapshot: "White",
      unit_price: 5997,
      quantity: 1,
      line_total: 5997,
    });
  });

  it("uses the real catalog category junction column", async () => {
    let sql = "";
    const catalogDatabase = {
      query: async (text: string) => {
        sql = text;
        return { rows: [], rowCount: 0 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductsRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      catalogDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 200);
    assert.match(sql, /pcp\.product_category_id/);
    assert.doesNotMatch(sql, /pcp\.category_id/);
  });

  it("requires staff access for catalog product detail", async () => {
    const response = await handleAdminCatalogProductRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1"),
      database,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 401);
  });

  it("requires idempotency and validates Worker product mutations before touching commerce data", async () => {
    const noKey = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${await staffToken()}` },
        body: JSON.stringify({ title: "Canary", pricePhp: 5997 }),
      }), database, { JWT_SECRET: "test-secret" },
    );
    assert.equal(noKey.status, 400);
    const invalid = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${await staffToken()}`, "Idempotency-Key": "product-invalid" },
        body: JSON.stringify({ title: "", pricePhp: -1 }),
      }), database, { JWT_SECRET: "test-secret" },
    );
    assert.equal(invalid.status, 400);
  });

  it("creates a complete commerce product graph in one idempotent transaction", async () => {
    const statements: string[] = [];
    const productDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        statements.push(text);
        if (text.includes("FROM public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 0 };
        if (text.includes("INSERT INTO public.product_option (")) return { rows: [{ id: "option_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.product_option_value (")) return { rows: [{ id: "option_value_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.shipping_profile")) return { rows: [{ id: "shipping_profile_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.price_set")) return { rows: [{ id: "price_set_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.inventory_item")) return { rows: [{ id: "inventory_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.stock_location")) return { rows: [{ id: "location_1" }] as T[], rowCount: 1 };
        if (text.includes("UPDATE public.product SET")) return { rows: [] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.worker_idempotency_records")) return { rows: [] as T[], rowCount: 1 };
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: { Authorization: `Bearer ${await staffToken()}`, "Idempotency-Key": "product-create-1", "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Canary", pricePhp: 5997, sizeLabels: ["Full"], colorLabels: ["Natural"], categoryIds: ["category_1"], imageUrls: ["https://cdn.example/canary.jpg"], stockQuantity: 3 }),
      }),
      productDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 201);
    const body = (await response.json()) as { productId: string };
    assert.match(body.productId, /^[0-9a-f-]{36}$/);
    assert.ok(statements.includes("BEGIN"));
    assert.ok(statements.includes("COMMIT"));
    assert.ok(statements.some((sql) => sql.includes("public.product_variant_price_set")));
    assert.ok(statements.some((sql) => sql.includes("public.product_variant_inventory_item")));
    assert.ok(statements.some((sql) => sql.includes("public.inventory_level")));
  });

  it("requires idempotency for catalog product deletion", async () => {
    const response = await handleAdminCatalogProductDeleteRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", { method: "DELETE", headers: { Authorization: `Bearer ${await staffToken()}` } }),
      database,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "idempotency_key_required" });
  });

  it("soft-deletes a product and its active variants transactionally", async () => {
    const queries: string[] = [];
    const deleteDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        queries.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records")) return { rows: [{ state: "claimed", request_hash: "" }] as T[], rowCount: 1 };
        if (text.startsWith("UPDATE public.product\n")) return { rows: [{ id: "product_1" }] as T[], rowCount: 1 };
        if (text.startsWith("UPDATE public.worker_idempotency_records")) return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductDeleteRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", { method: "DELETE", headers: { Authorization: `Bearer ${await staffToken()}`, "Idempotency-Key": "delete-product-1" } }),
      deleteDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { deleted: true, productId: "product_1" });
    assert.equal(queries[0]?.startsWith("INSERT INTO public.worker_idempotency_records"), true);
    assert.equal(queries.some((query) => query.includes("UPDATE public.product_variant")), true);
    assert.equal(queries.includes("BEGIN"), true);
    assert.equal(queries.includes("COMMIT"), true);
  });

  it("loads catalog detail through the commerce schema", async () => {
    let sql = "";
    const catalogDatabase = {
      query: async (text: string) => {
        sql = text;
        return {
          rows: [{
            id: "product_1",
            title: "Canary",
            handle: "canary",
            description: null,
            status: "published",
            thumbnail: null,
            metadata: {},
            images: [],
            categories: [],
            options: [],
            variants: [],
          }],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      catalogDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { product: { id: string; variants: unknown[] } };
    assert.equal(body.product.id, "product_1");
    assert.deepEqual(body.product.variants, []);
    assert.match(sql, /product_variant_price_set/);
    assert.match(sql, /product_category_id/);
  });

  it("lists product categories from the commerce schema", async () => {
    let sql = "";
    const categoryDatabase = {
      query: async (text: string) => {
        sql = text;
        return { rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogCategoriesRequest(
      new Request("https://worker.test/api/admin/catalog/categories", {
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      categoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { categories: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }] });
    assert.match(sql, /product_category/);
  });

  it("requires idempotency and rejects duplicate category handles", async () => {
    const categoryDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        if (text.includes("WHERE handle")) {
          return { rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }] as T[], rowCount: 1 };
        }
        return { rows: [] as T[], rowCount: 0 };
      },
      end: async () => undefined,
    };
    const base = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await staffToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Guitars" }),
    } as const;
    const missing = await handleAdminCatalogCategoriesRequest(
      new Request("https://worker.test/api/admin/catalog/categories", base),
      categoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(missing.status, 400);
    const duplicate = await handleAdminCatalogCategoriesRequest(
      new Request("https://worker.test/api/admin/catalog/categories", {
        ...base,
        headers: { ...base.headers, "Idempotency-Key": "category-1" },
      }),
      categoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(duplicate.status, 409);
  });

  it("creates a category transactionally and stores the replay response", async () => {
    const statements: string[] = [];
    const categoryDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        statements.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
          return { rows: [{ state: "pending", request_hash: "hash" }] as T[], rowCount: 1 };
        }
        if (text.includes("WHERE handle")) return { rows: [] as T[], rowCount: 0 };
        if (text.startsWith("INSERT INTO public.product_category")) {
          return { rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }] as T[], rowCount: 1 };
        }
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogCategoriesRequest(
      new Request("https://worker.test/api/admin/catalog/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "category-create-1",
        },
        body: JSON.stringify({ name: "Guitars" }),
      }),
      categoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { category: { id: "pcat_1", name: "Guitars", handle: "guitars" } });
    assert.equal(statements[0]?.startsWith("INSERT INTO public.worker_idempotency_records"), true);
    assert.equal(statements.includes("BEGIN"), true);
    assert.equal(statements.includes("COMMIT"), true);
    assert.equal(statements.some((statement) => statement.startsWith("UPDATE public.worker_idempotency_records")), true);
  });
});
