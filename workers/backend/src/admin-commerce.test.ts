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

async function staffToken(
  organizationId?: string,
  claimKey = "organization_id",
): Promise<string> {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({
    sub: "staff_1",
    role: "admin",
    exp: 2_000_000_000,
    [claimKey]: organizationId ?? "org_1",
  });
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = encodeBytes(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${header}.${payload}`),
      ),
    ),
  );
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

  it("returns variant inventory only for a product owned by the staff organization", async () => {
    let statement = "";
    let parameters: unknown[] = [];
    const inventoryDatabase = {
      query: async (sql: string, values: unknown[]) => {
        statement = sql;
        parameters = values;
        return {
          rows: [
            {
              product_id: "prod_1",
              variant_id: "variant_1",
              inventory_item_id: "item_1",
              location_id: "loc_1",
              stocked_quantity: "12",
              reserved_quantity: "3",
            },
          ],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    };
    const response = await handleAdminInventoryRequest(
      new Request(
        "https://worker.test/api/admin/inventory?variantId=variant_1&locationId=loc_1",
        {
          headers: { Authorization: `Bearer ${await staffToken("org_1")}` },
        },
      ),
      inventoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: {
        productId: "prod_1",
        variantId: "variant_1",
        inventoryItemId: "item_1",
        locationId: "loc_1",
        stockedQuantity: 12,
        reservedQuantity: 3,
        availableQuantity: 9,
      },
    });
    assert.match(statement, /p\.metadata->>'organization_id' = \$4/);
    assert.deepEqual(parameters, ["loc_1", "variant_1", null, "org_1"]);
  });

  it("resolves inventory-item reads through the default active stock location", async () => {
    let statement = "";
    const inventoryDatabase = {
      query: async (sql: string) => {
        statement = sql;
        return {
          rows: [
            {
              product_id: "prod_1",
              variant_id: "variant_1",
              inventory_item_id: "item_1",
              location_id: "loc_default",
              stocked_quantity: "8",
              reserved_quantity: "2",
            },
          ],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    };
    const response = await handleAdminInventoryRequest(
      new Request(
        "https://worker.test/api/admin/inventory?inventoryItemId=item_1&locationId=default",
        {
          headers: { Authorization: `Bearer ${await staffToken("org_1")}` },
        },
      ),
      inventoryDatabase,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      data: { locationId: string; availableQuantity: number };
    };
    assert.equal(payload.data.locationId, "loc_default");
    assert.equal(payload.data.availableQuantity, 6);
    assert.match(
      statement,
      /SELECT id FROM public\.stock_location WHERE deleted_at IS NULL ORDER BY created_at, id LIMIT 1/,
    );
  });

  it("rejects order detail reads without a verified staff bearer token", async () => {
    const response = await handleAdminOrderDetailRequest(
      new Request("https://worker.test/api/admin/orders/order_1"),
      database,
      { JWT_SECRET: "test-secret" },
      "order_1",
      database,
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
    let orderStatement = "";
    let orderValues: readonly unknown[] = [];
    const orderDatabase = {
      query: async (text: string, values: readonly unknown[] = []) => {
        orderStatement = text;
        orderValues = values;
        return {
          rows: [
            {
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
              items: [
                {
                  id: "item_1",
                  product_name_snapshot: "Canary",
                  sku_snapshot: "GUITAR-ACO-WHITE",
                  size_snapshot: "",
                  color_snapshot: "White",
                  unit_price: 599700,
                  quantity: 1,
                  line_total: 599700,
                },
              ],
              payments: [],
            },
          ],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    };
    const appDatabase = {
      query: async (text: string, values: readonly unknown[]) => {
        assert.match(text, /organization_id = \$1 AND order_id = \$2/);
        assert.deepEqual(values, ["org_1", "order_1"]);
        return {
          rows: [
            {
              id: "shipment-1",
              courier_slug: "jtexpress-ph",
              status: "assigned",
              tracking_url: "https://track.example/1",
              metadata: {
                tracking_number: "JT123",
                label_url: "https://label.example/1",
              },
              created_at: "2026-09-20T00:00:00.000Z",
            },
          ],
          rowCount: 1,
        };
      },
      end: async () => undefined,
    };
    const response = await handleAdminOrderDetailRequest(
      new Request("https://worker.test/api/admin/orders/order_1", {
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      orderDatabase,
      { JWT_SECRET: "test-secret" },
      "order_1",
      appDatabase,
    );
    assert.equal(response.status, 200);
    assert.match(
      orderStatement,
      /COALESCE\(o\.metadata->>'organization_id', o\.metadata->>'store_id'\) = \$2/,
    );
    assert.deepEqual(orderValues, ["order_1", "org_1"]);
    const body = (await response.json()) as {
      order: {
        order_items: Array<Record<string, unknown>>;
        shipments: Array<Record<string, unknown>>;
      };
    };
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
    assert.deepEqual(body.order.shipments[0], {
      id: "shipment-1",
      tracking_number: "JT123",
      carrier_slug: "jtexpress-ph",
      status: "assigned",
      label_url: "https://label.example/1",
      shipped_at: "2026-09-20T00:00:00.000Z",
      tracking_url: "https://track.example/1",
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
      }),
      database,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(noKey.status, 400);
    const invalid = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-invalid",
        },
        body: JSON.stringify({ title: "", pricePhp: -1 }),
      }),
      database,
      { JWT_SECRET: "test-secret" },
    );
    assert.equal(invalid.status, 400);
  });

  it("rejects publishing a new product without approved media", async () => {
    let commerceTouched = false;
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "published-product-without-media",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          status: "published",
        }),
      }),
      {
        query: async <T extends Record<string, unknown>>() => {
          commerceTouched = true;
          return { rows: [] as T[], rowCount: 0 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      undefined,
      database,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "catalog_media_required",
      code: "CATALOG_MEDIA_REQUIRED",
    });
    assert.equal(commerceTouched, false);
  });

  it("rejects prices that cannot be represented as a safe PHP minor-unit amount", async () => {
    let commerceTouched = false;
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-price-overflow",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: Number.MAX_SAFE_INTEGER,
        }),
      }),
      {
        query: async <T extends Record<string, unknown>>() => {
          commerceTouched = true;
          return { rows: [] as T[], rowCount: 0 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      undefined,
      database,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "invalid_product_payload",
    });
    assert.equal(commerceTouched, false);
  });

  it("rejects invalid direct Worker stock mutations without touching either database", async () => {
    let databaseTouched = false;
    for (const stockFields of [
      { stockQuantity: -1 },
      { stockQuantity: 1.5 },
      { stockQuantity: 10_000_001 },
      { variantStocks: [{ variantId: "variant_1", quantity: -1 }] },
      {
        variantStocks: [
          { variantId: "variant_1", quantity: 2 },
          { variantId: "variant_1", quantity: 3 },
        ],
      },
      {
        matrixCellStocks: [
          { sizeLabel: "Full", colorLabel: "Natural", quantity: 1.5 },
        ],
      },
      {
        matrixCellStocks: [
          { sizeLabel: "Full", colorLabel: "Natural", quantity: 1 },
          { sizeLabel: "Full", colorLabel: "Natural", quantity: 2 },
        ],
      },
    ]) {
      const response = await handleAdminCatalogProductMutationRequest(
        new Request("https://worker.test/api/admin/catalog/products", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await staffToken()}`,
            "Idempotency-Key": `invalid-stock-${crypto.randomUUID()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Canary",
            pricePhp: 5997,
            ...stockFields,
          }),
        }),
        {
          query: async () => {
            databaseTouched = true;
            return { rows: [], rowCount: 0 };
          },
          end: async () => undefined,
        },
        { JWT_SECRET: "test-secret" },
        undefined,
        {
          query: async () => {
            databaseTouched = true;
            return { rows: [], rowCount: 0 };
          },
          end: async () => undefined,
        },
      );
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "invalid_product_payload",
      });
    }
    assert.equal(databaseTouched, false);
  });

  it("rejects malformed direct Worker catalog fields instead of silently dropping them", async () => {
    let databaseTouched = false;
    for (const invalidFields of [
      { imageUrls: "https://cdn.example/canary.jpg" },
      { categoryIds: ["category_1", 42] },
      { sizeLabels: ["Full", null] },
      { colorLabels: "Natural" },
      { status: "archived" },
      { storefrontMetadata: [] },
      {
        variantStocks: [
          {
            variantId: "variant_1",
            quantity: 2,
            inventoryItemId: "other_item",
          },
        ],
      },
    ]) {
      const response = await handleAdminCatalogProductMutationRequest(
        new Request("https://worker.test/api/admin/catalog/products", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await staffToken()}`,
            "Idempotency-Key": `invalid-catalog-${crypto.randomUUID()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Canary",
            pricePhp: 5997,
            ...invalidFields,
          }),
        }),
        {
          query: async () => {
            databaseTouched = true;
            return { rows: [], rowCount: 0 };
          },
          end: async () => undefined,
        },
        { JWT_SECRET: "test-secret" },
        undefined,
        {
          query: async () => {
            databaseTouched = true;
            return { rows: [], rowCount: 0 };
          },
          end: async () => undefined,
        },
      );
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), {
        error: "invalid_product_payload",
      });
    }
    assert.equal(databaseTouched, false);
  });

  it("rejects stock overrides for matrix cells that are not part of the product", async () => {
    let databaseTouched = false;
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "invalid-stock-cell",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
          matrixCellStocks: [
            { sizeLabel: "Mini", colorLabel: "Blue", quantity: 2 },
          ],
        }),
      }),
      {
        query: async () => {
          databaseTouched = true;
          return { rows: [], rowCount: 0 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      undefined,
      {
        query: async () => {
          databaseTouched = true;
          return { rows: [], rowCount: 0 };
        },
        end: async () => undefined,
      },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "invalid_product_payload",
    });
    assert.equal(databaseTouched, false);
  });

  it("rolls back a product update that references another product's variant stock id", async () => {
    const commerceTransactions: string[] = [];
    const appTransactions: string[] = [];
    const productDatabase = {
      query: async <T extends Record<string, unknown>>(
        sql: string,
        values: readonly unknown[] = [],
      ) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql))
          commerceTransactions.push(sql);
        if (sql.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [{ state: "claimed", request_hash: values[1] }] as T[],
            rowCount: 1,
          };
        if (sql.includes("SELECT id, metadata, thumbnail, updated_at"))
          return {
            rows: [
              {
                id: "product_1",
                metadata: { organization_id: "org_1" },
                thumbnail: null,
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ] as T[],
            rowCount: 1,
          };
        if (sql.includes("FROM public.shipping_profile"))
          return { rows: [{ id: "shipping_1" }] as T[], rowCount: 1 };
        if (sql.startsWith("SELECT v.id, v.sku, v.barcode"))
          return {
            rows: [
              {
                id: "variant_owned",
                sku: null,
                barcode: null,
                size: "Full",
                color: "Natural",
              },
            ] as T[],
            rowCount: 1,
          };
        if (sql.startsWith("UPDATE public.worker_idempotency_records"))
          return { rows: [] as T[], rowCount: 1 };
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const appDatabase = {
      query: async <T extends Record<string, unknown>>(sql: string) => {
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql))
          appTransactions.push(sql);
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "foreign-variant-stock",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          expected_revision: "2026-01-01T00:00:00.000Z",
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
          variantStocks: [{ variantId: "variant_other", quantity: 5 }],
        }),
      }),
      productDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
      appDatabase,
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "catalog_variant_stock_not_owned",
      code: "CATALOG_VARIANT_STOCK_NOT_OWNED",
    });
    assert.ok(commerceTransactions.includes("ROLLBACK"));
    assert.ok(appTransactions.includes("ROLLBACK"));
    assert.equal(commerceTransactions.includes("COMMIT"), false);
    assert.equal(appTransactions.includes("COMMIT"), false);
  });

  it("rejects unsafe catalog image references before opening a database transaction", async () => {
    let databaseTouched = false;
    const imageDatabase = {
      query: async <T extends Record<string, unknown>>() => {
        databaseTouched = true;
        return { rows: [] as T[], rowCount: 0 };
      },
      end: async () => undefined,
    };
    for (const image of [
      "http://cdn.example/image.jpg",
      "//cdn.example/image.jpg",
      "https://user:password@cdn.example/image.jpg",
      "https://cdn.example/image.jpg\nX-Injected: true",
    ]) {
      const response = await handleAdminCatalogProductMutationRequest(
        new Request("https://worker.test/api/admin/catalog/products", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await staffToken()}`,
            "Idempotency-Key": `product-image-${btoa(image)
              .replace(/[^a-z0-9]/gi, "")
              .slice(0, 24)}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Canary",
            pricePhp: 5997,
            imageUrls: [image],
          }),
        }),
        imageDatabase,
        { JWT_SECRET: "test-secret" },
        undefined,
        imageDatabase,
      );
      assert.equal(response.status, 400, image);
      assert.deepEqual(
        await response.json(),
        { error: "invalid_product_payload" },
        image,
      );
    }
    assert.equal(databaseTouched, false);
  });

  it("rejects catalog updates for a product owned by another organization", async () => {
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken("org_attacker")}`,
          "Idempotency-Key": "product-cross-tenant",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
        }),
      }),
      {
        query: async <T extends Record<string, unknown>>(text: string) => {
          if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
            return {
              rows: [{ state: "claimed", request_hash: "" }] as T[],
              rowCount: 1,
            };
          if (text.includes("SELECT id, metadata, thumbnail, updated_at"))
            return {
              rows: [
                {
                  id: "product_1",
                  metadata: { organization_id: "org_owner" },
                  thumbnail: null,
                  updated_at: "2026-01-01T00:00:00.000Z",
                },
              ] as T[],
              rowCount: 1,
            };
          return { rows: [] as T[], rowCount: 1 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      "product_1",
      database,
    );
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "catalog_product_not_owned",
      code: "CATALOG_PRODUCT_NOT_OWNED",
    });
  });

  it("rejects catalog updates without the exact server revision before writing", async () => {
    const writes: string[] = [];
    const revisionDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        writes.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [{ state: "claimed", request_hash: "" }] as T[],
            rowCount: 1,
          };
        if (text.includes("SELECT id, metadata, thumbnail, updated_at"))
          return {
            rows: [
              {
                id: "product_1",
                metadata: { organization_id: "org_1" },
                thumbnail: null,
                updated_at: "2026-01-01T00:00:00.123Z",
              },
            ] as T[],
            rowCount: 1,
          };
        return { rows: [], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-revision-missing",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
        }),
      }),
      revisionDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
      database,
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "catalog_conflict",
      code: "CATALOG_CONFLICT",
    });
    assert.equal(
      writes.some((query) => query.startsWith("UPDATE public.product SET")),
      false,
    );
  });

  it("accepts org_id as the staff tenant claim for catalog writes", async () => {
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken("org_1", "org_id")}`,
          "Idempotency-Key": "product-org-alias",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
        }),
      }),
      {
        query: async <T extends Record<string, unknown>>(text: string) => {
          if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
            return {
              rows: [{ state: "claimed", request_hash: "" }] as T[],
              rowCount: 1,
            };
          if (text.includes("SELECT id, metadata, thumbnail, updated_at"))
            return {
              rows: [
                {
                  id: "product_1",
                  metadata: { organization_id: "org_1" },
                  thumbnail: null,
                  updated_at: "2026-01-01T00:00:00.123Z",
                },
              ] as T[],
              rowCount: 1,
            };
          return { rows: [] as T[], rowCount: 1 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      "product_1",
      database,
    );
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
      error: "catalog_conflict",
      code: "CATALOG_CONFLICT",
    });
  });

  it("creates a complete commerce product graph in one idempotent transaction", async () => {
    const statements: string[] = [];
    const appStatements: string[] = [];
    const transactionOrder: string[] = [];
    const parameters: Array<{ text: string; values: readonly unknown[] }> = [];
    const longDescription = "d".repeat(12_000);
    const productDatabase = {
      query: async <T extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        statements.push(text);
        if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text))
          transactionOrder.push(`commerce:${text}`);
        parameters.push({ text, values });
        if (text.includes("FROM public.worker_idempotency_records"))
          return { rows: [] as T[], rowCount: 0 };
        if (text.includes("INSERT INTO public.product_option ("))
          return { rows: [{ id: "option_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.product_option_value ("))
          return { rows: [{ id: "option_value_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.shipping_profile"))
          return { rows: [{ id: "shipping_profile_1" }] as T[], rowCount: 1 };
        if (text.includes("SELECT id FROM public.product_category WHERE id=$1"))
          return { rows: [{ id: "category_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.price_set"))
          return { rows: [{ id: "price_set_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.inventory_item"))
          return { rows: [{ id: "inventory_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.stock_location"))
          return { rows: [{ id: "location_1" }] as T[], rowCount: 1 };
        if (text.includes("UPDATE public.product SET"))
          return { rows: [] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.worker_idempotency_records"))
          return { rows: [] as T[], rowCount: 1 };
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-create-1",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          description: longDescription,
          pricePhp: 5997,
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
          categoryIds: ["category_1"],
          storefrontMetadata: {
            mediaIds: ["00000000-0000-4000-8000-000000000002"],
          },
          stockQuantity: 3,
        }),
      }),
      productDatabase,
      { JWT_SECRET: "test-secret" },
      undefined,
      {
        query: async <T extends Record<string, unknown>>(
          text: string,
          values: readonly unknown[] = [],
        ) => {
          appStatements.push(text);
          if (["BEGIN", "COMMIT", "ROLLBACK"].includes(text))
            transactionOrder.push(`app:${text}`);
          if (text.includes("FROM public.cms_media"))
            return {
              rows: [
                {
                  id: "00000000-0000-4000-8000-000000000002",
                  public_url: "https://cdn.example/canary.jpg",
                },
              ] as T[],
              rowCount: 1,
            };
          if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
            return {
              rows: [
                { state: "pending", request_hash: String(values[1] ?? "") },
              ] as T[],
              rowCount: 1,
            };
          return { rows: [] as T[], rowCount: 1 };
        },
        end: async () => undefined,
      },
    );
    assert.equal(response.status, 201);
    const body = (await response.json()) as { productId: string };
    assert.match(body.productId, /^[0-9a-f-]{36}$/);
    assert.ok(statements.includes("BEGIN"));
    assert.ok(statements.includes("COMMIT"));
    assert.ok(
      statements.some((sql) =>
        sql.includes("public.product_variant_price_set"),
      ),
    );
    assert.ok(
      statements.some((sql) =>
        sql.includes("public.product_variant_inventory_item"),
      ),
    );
    assert.ok(statements.some((sql) => sql.includes("public.inventory_level")));
    assert.ok(
      parameters.some(
        ({ text, values }) =>
          text.includes("INSERT INTO public.image") &&
          values[1] === "https://cdn.example/canary.jpg",
      ),
    );
    assert.ok(
      parameters.some(
        ({ text, values }) =>
          text.includes("INSERT INTO public.product (id, title") &&
          values[3] === longDescription,
      ),
      "Worker must preserve descriptions within the API's 50,000-character limit",
    );
    assert.equal(appStatements.includes("BEGIN"), true);
    assert.equal(appStatements.includes("COMMIT"), true);
    assert.ok(
      appStatements.some(
        (sql) =>
          sql.includes("FROM public.cms_media") && sql.includes("FOR SHARE"),
      ),
      "catalog media must remain locked while commerce references are written",
    );
    const appMutationBegin = transactionOrder.indexOf("app:BEGIN");
    const commerceCommit = transactionOrder.indexOf("commerce:COMMIT");
    const appMutationCommit = transactionOrder.indexOf("app:COMMIT");
    assert.ok(
      appMutationBegin >= 0 &&
        appMutationBegin < commerceCommit &&
        commerceCommit < appMutationCommit,
      "APP media lock must outlive the MEDUSA transaction",
    );
    const claimIndex = statements.findIndex((sql) =>
      sql.startsWith("INSERT INTO public.worker_idempotency_records"),
    );
    const commerceBegin = statements.indexOf("BEGIN");
    const completionIndex = statements.findIndex((sql) =>
      sql.startsWith("UPDATE public.worker_idempotency_records"),
    );
    const commerceCommitIndex = statements.indexOf("COMMIT");
    assert.ok(
      commerceBegin >= 0 &&
        commerceBegin < claimIndex &&
        claimIndex < completionIndex &&
        completionIndex < commerceCommitIndex,
      "catalog mutation, idempotency claim, and replay response must commit atomically in MEDUSA",
    );
    assert.equal(
      appStatements.some((sql) =>
        sql.startsWith("INSERT INTO public.audit_logs"),
      ),
      true,
    );
  });

  it("repairs APP media references when retrying a commerce-committed catalog mutation", async () => {
    type StoredResponse = {
      idempotency_key: string;
      request_hash: string;
      state: string;
      response_status: number;
      response_headers: Array<[string, string]>;
      response_body: string;
      created_at: string;
    };
    const records = new Map<string, StoredResponse>();
    const makeDatabase = (role: "app" | "commerce") => ({
      query: async <T extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
          const key = `${role}:${String(values[0])}`;
          if (records.has(key)) return { rows: [] as T[], rowCount: 0 };
          records.set(key, {
            idempotency_key: String(values[0]),
            request_hash: String(values[1]),
            state: "pending",
            response_status: 102,
            response_headers: [],
            response_body: "",
            created_at: new Date().toISOString(),
          });
          return {
            rows: [{ state: "pending", request_hash: String(values[1]) } as T],
            rowCount: 1,
          };
        }
        if (text.startsWith("UPDATE public.worker_idempotency_records")) {
          const record = records.get(`${role}:${String(values[0])}`);
          if (!record || record.request_hash !== values[1])
            return { rows: [] as T[], rowCount: 0 };
          Object.assign(record, {
            state: "completed",
            response_status: values[2],
            response_headers: JSON.parse(String(values[3])) as Array<
              [string, string]
            >,
            response_body: String(values[4]),
          });
          return { rows: [] as T[], rowCount: 1 };
        }
        if (text.startsWith("DELETE FROM public.worker_idempotency_records")) {
          records.delete(`${role}:${String(values[0])}`);
          return { rows: [] as T[], rowCount: 1 };
        }
        if (
          text.includes(
            "FROM public.worker_idempotency_records WHERE idempotency_key",
          )
        ) {
          const record = records.get(`${role}:${String(values[0])}`);
          return {
            rows: record ? [record as T] : [],
            rowCount: record ? 1 : 0,
          };
        }
        if (role === "commerce") {
          if (text.startsWith("SELECT id, metadata, thumbnail, updated_at"))
            return { rows: [] as T[], rowCount: 0 };
          if (text.startsWith("INSERT INTO public.product (id, title"))
            return { rows: [] as T[], rowCount: 1 };
          if (text.includes("FROM public.shipping_profile"))
            return { rows: [{ id: "shipping_1" }] as T[], rowCount: 1 };
          if (text.startsWith("SELECT v.id, v.sku, v.barcode"))
            return { rows: [] as T[], rowCount: 0 };
          if (text.includes("INSERT INTO public.product_option ("))
            return { rows: [{ id: String(values[0]) }] as T[], rowCount: 1 };
          if (text.includes("INSERT INTO public.product_option_value ("))
            return { rows: [{ id: String(values[0]) }] as T[], rowCount: 1 };
          if (text.includes("INSERT INTO public.price_set"))
            return { rows: [{ id: String(values[0]) }] as T[], rowCount: 1 };
          if (text.includes("INSERT INTO public.inventory_item"))
            return { rows: [{ id: String(values[0]) }] as T[], rowCount: 1 };
        }
        if (role === "app" && text.includes("FROM public.cms_media"))
          return { rows: [] as T[], rowCount: 0 };
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    });
    const commerceDatabase = makeDatabase("commerce");
    const appDatabase = makeDatabase("app");
    let productWrites = 0;
    let mediaRegistrationAttempts = 0;
    let failFirstAppCommit = true;
    const commerceQuery = commerceDatabase.query;
    commerceDatabase.query = async <T extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) => {
      if (text.startsWith("INSERT INTO public.product (id, title"))
        productWrites += 1;
      return commerceQuery<T>(text, values);
    };
    const appQuery = appDatabase.query;
    appDatabase.query = async <T extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) => {
      if (text.startsWith("INSERT INTO public.cms_media"))
        mediaRegistrationAttempts += 1;
      if (text === "COMMIT" && failFirstAppCommit) {
        failFirstAppCommit = false;
        throw new Error("simulated_app_commit_failure");
      }
      return appQuery<T>(text, values);
    };
    const authorization = `Bearer ${await staffToken()}`;
    const makeRequest = () =>
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Idempotency-Key": "catalog-cross-db-recovery",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          imageUrls: ["https://cdn.example/canary.jpg"],
        }),
      });
    const first = await handleAdminCatalogProductMutationRequest(
      await makeRequest(),
      commerceDatabase,
      { JWT_SECRET: "test-secret" },
      undefined,
      appDatabase,
    );
    assert.equal(
      first.status,
      503,
      "the simulated ambiguous APP commit is surfaced as a retryable service failure",
    );
    const retry = await handleAdminCatalogProductMutationRequest(
      await makeRequest(),
      commerceDatabase,
      { JWT_SECRET: "test-secret" },
      undefined,
      appDatabase,
    );
    assert.equal(retry.status, 201);
    assert.equal(
      productWrites,
      1,
      "the completed commerce mutation is replayed, not duplicated",
    );
    assert.equal(
      mediaRegistrationAttempts,
      2,
      "the APP media projection is rebuilt during the successful replay",
    );
  });

  it("clears the persisted thumbnail when an update explicitly clears the image gallery", async () => {
    let productUpdateValues: readonly unknown[] | undefined;
    let idempotencyWrites = 0;
    const productDatabase = {
      query: async <T extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [{ state: "pending", request_hash: "" }] as T[],
            rowCount: 1,
          };
        if (text.includes("SELECT id, metadata, thumbnail, updated_at"))
          return {
            rows: [
              {
                id: "product_1",
                metadata: { organization_id: "org_1" },
                thumbnail: "https://cdn.example/old.jpg",
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ] as T[],
            rowCount: 1,
          };
        if (text.startsWith("UPDATE public.product SET title="))
          productUpdateValues = values;
        if (text.includes("INSERT INTO public.product_option ("))
          return { rows: [{ id: values[0] }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.product_option_value ("))
          return { rows: [{ id: values[0] }] as T[], rowCount: 1 };
        if (text.includes("FROM public.shipping_profile"))
          return { rows: [{ id: "shipping_profile_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.price_set"))
          return { rows: [{ id: "price_set_1" }] as T[], rowCount: 1 };
        if (text.includes("INSERT INTO public.inventory_item"))
          return { rows: [{ id: "inventory_1" }] as T[], rowCount: 1 };
        if (text.startsWith("UPDATE public.worker_idempotency_records"))
          idempotencyWrites += 1;
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-clear-gallery",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          expected_revision: "2026-01-01T00:00:00.000Z",
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
          imageUrls: [],
        }),
      }),
      productDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
      {
        query: async <T extends Record<string, unknown>>() => ({
          rows: [] as T[],
          rowCount: 1,
        }),
        end: async () => undefined,
      },
    );
    assert.equal(response.status, 200);
    assert.equal(productUpdateValues?.[5], null);
    assert.equal(idempotencyWrites, 1);
  });

  it("keeps the linked inventory item's denormalized SKU and title aligned with product edits", async () => {
    let inventoryItemUpdate: readonly unknown[] | undefined;
    const productDatabase = {
      query: async <T extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [
              { state: "pending", request_hash: String(values[1] ?? "") },
            ] as T[],
            rowCount: 1,
          };
        if (text.includes("SELECT id, metadata, thumbnail, updated_at"))
          return {
            rows: [
              {
                id: "product_1",
                metadata: { organization_id: "org_1" },
                thumbnail: null,
                updated_at: "2026-01-01T00:00:00.000Z",
              },
            ] as T[],
            rowCount: 1,
          };
        if (text.startsWith("SELECT v.id, v.sku, v.barcode"))
          return {
            rows: [
              {
                id: "variant_1",
                sku: "OLD-SKU",
                barcode: null,
                size: "Full",
                color: "Natural",
              },
            ] as T[],
            rowCount: 1,
          };
        if (text.startsWith("INSERT INTO public.product_option ("))
          return { rows: [{ id: values[0] }] as T[], rowCount: 1 };
        if (text.startsWith("INSERT INTO public.product_option_value ("))
          return { rows: [{ id: values[0] }] as T[], rowCount: 1 };
        if (text.includes("FROM public.shipping_profile"))
          return { rows: [{ id: "shipping_profile_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.product_variant_price_set"))
          return {
            rows: [{ price_set_id: "price_set_1" }] as T[],
            rowCount: 1,
          };
        if (text.includes("FROM public.price WHERE"))
          return { rows: [{ id: "price_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.product_variant_inventory_item"))
          return {
            rows: [{ inventory_item_id: "inventory_1" }] as T[],
            rowCount: 1,
          };
        if (text.includes("FROM public.stock_location"))
          return { rows: [{ id: "location_1" }] as T[], rowCount: 1 };
        if (text.includes("FROM public.inventory_level"))
          return {
            rows: [{ stocked_quantity: 4, reserved_quantity: 0 }] as T[],
            rowCount: 1,
          };
        if (text.startsWith("UPDATE public.inventory_item SET sku=$2"))
          inventoryItemUpdate = values;
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-update-inventory-sku",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary Revised",
          pricePhp: 5997,
          sku: "CANARY-NEW",
          expected_revision: "2026-01-01T00:00:00.000Z",
          sizeLabels: ["Full"],
          colorLabels: ["Natural"],
        }),
      }),
      productDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
      {
        query: async <T extends Record<string, unknown>>() => ({
          rows: [] as T[],
          rowCount: 1,
        }),
        end: async () => undefined,
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual(inventoryItemUpdate, [
      "inventory_1",
      "CANARY-NEW",
      "Canary Revised Full Natural",
    ]);
  });

  it("resolves catalog media IDs inside the Worker against the caller organization", async () => {
    let commerceProductTouched = false;
    let mediaLookup: readonly unknown[] | undefined;
    const response = await handleAdminCatalogProductMutationRequest(
      new Request("https://worker.test/api/admin/catalog/products", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "product-media-tenant",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Canary",
          pricePhp: 5997,
          storefrontMetadata: {
            mediaIds: ["00000000-0000-4000-8000-000000000001"],
          },
        }),
      }),
      {
        query: async <T extends Record<string, unknown>>(text: string) => {
          if (text.includes("INSERT INTO public.worker_idempotency_records"))
            return {
              rows: [{ state: "pending", request_hash: "" }] as T[],
              rowCount: 1,
            };
          if (text.startsWith("INSERT INTO public.product"))
            commerceProductTouched = true;
          return { rows: [] as T[], rowCount: 1 };
        },
        end: async () => undefined,
      },
      { JWT_SECRET: "test-secret" },
      undefined,
      {
        query: async <T extends Record<string, unknown>>(
          text: string,
          values: readonly unknown[] = [],
        ) => {
          if (text.includes("FROM public.cms_media")) {
            mediaLookup = values;
            return { rows: [] as T[], rowCount: 0 };
          }
          return { rows: [] as T[], rowCount: 1 };
        },
        end: async () => undefined,
      },
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "catalog_media_unavailable",
      code: "CATALOG_MEDIA_UNAVAILABLE",
    });
    assert.deepEqual(mediaLookup, [
      ["00000000-0000-4000-8000-000000000001"],
      "org_1",
    ]);
    assert.equal(commerceProductTouched, false);
  });

  it("requires idempotency for catalog product deletion", async () => {
    const response = await handleAdminCatalogProductDeleteRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await staffToken()}` },
      }),
      database,
      database,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "idempotency_key_required",
    });
  });

  it("soft-deletes a product and its active variants transactionally", async () => {
    const queries: string[] = [];
    const deleteDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        queries.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [{ state: "claimed", request_hash: "" }] as T[],
            rowCount: 1,
          };
        if (text.startsWith("UPDATE public.product\n"))
          return { rows: [{ id: "product_1" }] as T[], rowCount: 1 };
        if (text.startsWith("UPDATE public.worker_idempotency_records"))
          return { rows: [], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const appQueries: string[] = [];
    const appDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        appQueries.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records"))
          return {
            rows: [{ state: "pending", request_hash: "" }] as T[],
            rowCount: 1,
          };
        return { rows: [], rowCount: 1 };
      },
      end: async () => undefined,
    };
    const response = await handleAdminCatalogProductDeleteRequest(
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "delete-product-1",
        },
      }),
      deleteDatabase,
      appDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      deleted: true,
      productId: "product_1",
    });
    assert.equal(
      queries[0]?.startsWith("INSERT INTO public.worker_idempotency_records"),
      true,
    );
    assert.equal(
      queries.some((query) => query.includes("UPDATE public.product_variant")),
      true,
    );
    assert.equal(queries.includes("BEGIN"), true);
    assert.equal(queries.includes("COMMIT"), true);
    assert.equal(appQueries.includes("BEGIN"), true);
    assert.equal(appQueries.includes("COMMIT"), true);
    assert.equal(
      appQueries.some((query) =>
        query.includes("INSERT INTO public.audit_logs"),
      ),
      true,
    );
    assert.equal(
      appQueries.some((query) =>
        query.includes("DELETE FROM public.admin_entity_workflow"),
      ),
      true,
    );
  });

  it("retries APP finalization after commerce deletion commits without deleting twice", async () => {
    type RecordRow = {
      state: string;
      request_hash: string;
      idempotency_key: string;
      response_status: number;
      response_headers: Array<[string, string]>;
      response_body: string;
      created_at: string;
    };
    const records = new Map<string, RecordRow>();
    const makeDatabase = (role: "app" | "commerce") => ({
      query: async <T extends Record<string, unknown>>(
        text: string,
        values: readonly unknown[] = [],
      ) => {
        if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
          const key = String(values[0]);
          if (records.has(`${role}:${key}`))
            return { rows: [] as T[], rowCount: 0 };
          records.set(`${role}:${key}`, {
            state: "pending",
            request_hash: String(values[1]),
            idempotency_key: key,
            response_status: 102,
            response_headers: [],
            response_body: "",
            created_at: new Date().toISOString(),
          });
          return {
            rows: [{ state: "pending", request_hash: String(values[1]) } as T],
            rowCount: 1,
          };
        }
        if (text.startsWith("DELETE FROM public.worker_idempotency_records")) {
          const key = `${role}:${String(values[0])}`;
          const record = records.get(key);
          if (record?.state === "pending") records.delete(key);
          return { rows: [] as T[], rowCount: 1 };
        }
        if (text.startsWith("UPDATE public.worker_idempotency_records")) {
          const record = records.get(`${role}:${String(values[0])}`);
          if (!record || record.request_hash !== values[1])
            return { rows: [] as T[], rowCount: 0 };
          Object.assign(record, {
            state: "completed",
            response_status: values[2],
            response_headers: JSON.parse(String(values[3])) as Array<
              [string, string]
            >,
            response_body: values[4],
          });
          return { rows: [] as T[], rowCount: 1 };
        }
        if (
          text.includes(
            "FROM public.worker_idempotency_records WHERE idempotency_key",
          )
        ) {
          const record = records.get(`${role}:${String(values[0])}`);
          return {
            rows: record ? [record as T] : [],
            rowCount: record ? 1 : 0,
          };
        }
        return { rows: [] as T[], rowCount: 1 };
      },
      end: async () => undefined,
    });
    const commerceDatabase = makeDatabase("commerce");
    const appDatabase = makeDatabase("app");
    let commerceDeleteCount = 0;
    let failAuditOnce = true;
    let workflowDeleteCount = 0;
    const commerceQuery = commerceDatabase.query;
    commerceDatabase.query = async <T extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) => {
      if (text.startsWith("UPDATE public.product\n")) {
        commerceDeleteCount += 1;
        return { rows: [{ id: "product_1" } as T], rowCount: 1 };
      }
      return commerceQuery<T>(text, values);
    };
    const appQuery = appDatabase.query;
    appDatabase.query = async <T extends Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ) => {
      if (text.startsWith("INSERT INTO public.audit_logs") && failAuditOnce) {
        failAuditOnce = false;
        throw new Error("temporary_app_failure");
      }
      if (text.startsWith("DELETE FROM public.admin_entity_workflow"))
        workflowDeleteCount += 1;
      return appQuery<T>(text, values);
    };
    const makeRequest = async () =>
      new Request("https://worker.test/api/admin/catalog/products/product_1", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${await staffToken()}`,
          "Idempotency-Key": "delete-product-retry",
        },
      });

    const first = await handleAdminCatalogProductDeleteRequest(
      await makeRequest(),
      commerceDatabase,
      appDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(first.status, 503);
    assert.equal(
      records.get("commerce:catalog-product-delete:org_1:delete-product-retry")
        ?.state,
      "completed",
    );
    assert.equal(
      records.has(
        "app:catalog-product-delete-finalize:org_1:delete-product-retry",
      ),
      false,
    );
    const retry = await handleAdminCatalogProductDeleteRequest(
      await makeRequest(),
      commerceDatabase,
      appDatabase,
      { JWT_SECRET: "test-secret" },
      "product_1",
    );
    assert.equal(retry.status, 200, await retry.clone().text());
    assert.deepEqual(await retry.json(), {
      deleted: true,
      productId: "product_1",
    });
    assert.equal(commerceDeleteCount, 1);
    assert.equal(workflowDeleteCount, 1);
  });

  it("loads catalog detail through the commerce schema", async () => {
    let sql = "";
    const catalogDatabase = {
      query: async (text: string) => {
        sql = text;
        return {
          rows: [
            {
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
            },
          ],
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
    const body = (await response.json()) as {
      product: { id: string; variants: unknown[] };
    };
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
        return {
          rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }],
          rowCount: 1,
        };
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
    assert.deepEqual(await response.json(), {
      categories: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }],
    });
    assert.match(sql, /product_category/);
  });

  it("requires idempotency and rejects duplicate category handles", async () => {
    const categoryDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        if (text.includes("WHERE handle")) {
          return {
            rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }] as T[],
            rowCount: 1,
          };
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
      categoryDatabase,
    );
    assert.equal(duplicate.status, 409);
  });

  it("creates a category transactionally and stores the replay response", async () => {
    const statements: string[] = [];
    const categoryDatabase = {
      query: async <T extends Record<string, unknown>>(text: string) => {
        statements.push(text);
        if (text.startsWith("INSERT INTO public.worker_idempotency_records")) {
          return {
            rows: [{ state: "pending", request_hash: "hash" }] as T[],
            rowCount: 1,
          };
        }
        if (text.includes("WHERE handle"))
          return { rows: [] as T[], rowCount: 0 };
        if (text.startsWith("INSERT INTO public.product_category")) {
          return {
            rows: [{ id: "pcat_1", name: "Guitars", handle: "guitars" }] as T[],
            rowCount: 1,
          };
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
      categoryDatabase,
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      category: { id: "pcat_1", name: "Guitars", handle: "guitars" },
    });
    assert.equal(
      statements[0]?.startsWith(
        "INSERT INTO public.worker_idempotency_records",
      ),
      true,
    );
    assert.equal(statements.includes("BEGIN"), true);
    assert.equal(statements.includes("COMMIT"), true);
    assert.equal(
      statements.some((statement) =>
        statement.startsWith("UPDATE public.worker_idempotency_records"),
      ),
      true,
    );
    assert.equal(
      statements.some((statement) =>
        statement.startsWith("INSERT INTO public.audit_logs"),
      ),
      true,
    );
  });
});
