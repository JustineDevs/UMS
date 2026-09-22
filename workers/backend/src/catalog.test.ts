import assert from "node:assert/strict";
import test from "node:test";
import {
  getPublishedProductByHandle,
  handleCatalogProductRequest,
  handleCatalogProductsRequest,
  handleCatalogCategoriesRequest,
  handleCatalogSearchSuggestionsRequest,
  handleCollectionsRequest,
  handleCollectionRequest,
  handleRegionsRequest,
  listPublishedProducts,
} from "./catalog.ts";

test("lists published products with bounded pagination and variant data", async () => {
  let query = "";
  let values: readonly unknown[] = [];
  const response = await listPublishedProducts(
    new Request("https://api.test/store/products?q=guitar&limit=500&offset=2"),
    {
      async query<Row>(
        text: string,
        parameters: readonly unknown[] = [],
      ): Promise<{ rows: Row[]; rowCount: number }> {
        query = text;
        values = parameters;
        return {
          rowCount: 1,
          rows: [
            {
              id: "prod-1",
              title: "Guitar",
              handle: "guitar",
              subtitle: null,
              description: "",
              thumbnail: null,
              status: "published",
              collection_id: null,
              variants: [{ id: "var-1", sku: "GTR-1" }],
              total_count: "1",
            },
          ] as Row[],
        };
      },
      async end(): Promise<void> {},
    },
  );

  assert.equal(response.limit, 100);
  assert.equal(response.offset, 2);
  assert.equal(response.count, 1);
  assert.equal(response.products[0]?.variants[0]?.sku, "GTR-1");
  assert.match(query, /p\.title ILIKE \$1/);
  assert.deepEqual(values, ["%guitar%", 100, 2]);
  assert.match(query, /p\.status = 'published'/);
  assert.match(query, /v\.deleted_at IS NULL/);
});

test("returns a cacheable storefront product response", async () => {
  const response = await handleCatalogProductsRequest(
    new Request("https://api.test/store/products"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return { rows: [], rowCount: 0 };
      },
      async end(): Promise<void> {},
    },
  );
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Cache-Control"),
    "public, max-age=30, s-maxage=60",
  );
  assert.deepEqual(await response.json(), {
    products: [],
    count: 0,
    limit: 20,
    offset: 0,
  });
});

test("returns priced Worker-native search suggestions", async () => {
  const response = await handleCatalogSearchSuggestionsRequest(
    new Request("https://api.test/store/search/suggestions?q=guitar"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return {
          rows: [{
            id: "prod-1",
            title: "Canary Guitar",
            handle: "canary",
            subtitle: null,
            description: null,
            thumbnail: "https://cdn.example/canary.jpg",
            status: "published",
            collection_id: null,
            variants: [{
              id: "var-1",
              calculated_price: { calculated_amount: 5997, currency_code: "php" },
            }],
            total_count: 1,
          }] as Row[],
          rowCount: 1,
        };
      },
      async end(): Promise<void> {},
    },
  );
  assert.deepEqual(await response.json(), {
    suggestions: [{
      slug: "canary",
      name: "Canary Guitar",
      minPrice: 5997,
      imageUrl: "https://cdn.example/canary.jpg",
    }],
  });
});

test("resolves one published product by an exact handle", async () => {
  let values: readonly unknown[] = [];
  const product = await getPublishedProductByHandle("canary", {
    async query<Row>(
      _text: string,
      parameters: readonly unknown[] = [],
    ): Promise<{ rows: Row[]; rowCount: number }> {
      values = parameters;
      return {
        rows: [
          {
            id: "prod-1",
            title: "Canary",
            handle: "canary",
            subtitle: null,
            description: null,
            thumbnail: "/canary.jpg",
            status: "published",
            collection_id: "col-1",
            variants: [],
            total_count: 1,
          },
        ] as Row[],
        rowCount: 1,
      };
    },
    async end(): Promise<void> {},
  });
  assert.equal(product?.handle, "canary");
  assert.deepEqual(values, ["canary"]);
});

test("returns 404 without leaking unpublished product data", async () => {
  const response = await handleCatalogProductRequest(
    new Request("https://api.test/store/products/hidden"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return { rows: [], rowCount: 0 };
      },
      async end(): Promise<void> {},
    },
    "hidden",
  );
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    type: "not_found",
    message: "Product not found",
  });
});

test("returns active regions in the storefront contract shape", async () => {
  const response = await handleRegionsRequest(
    new Request("https://api.test/store/regions"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return {
          rows: [{ id: "reg-ph", name: "Philippines", currency_code: "php" }] as Row[],
          rowCount: 1,
        };
      },
      async end(): Promise<void> {},
    },
  );
  assert.deepEqual(await response.json(), {
    regions: [{ id: "reg-ph", name: "Philippines", currency_code: "php" }],
  });
});

test("returns paginated collections without exposing query metadata", async () => {
  let values: readonly unknown[] = [];
  const response = await handleCollectionsRequest(
    new Request("https://api.test/store/collections?limit=5&offset=2"),
    {
      async query<Row>(
        _text: string,
        parameters: readonly unknown[] = [],
      ): Promise<{ rows: Row[]; rowCount: number }> {
        values = parameters;
        return {
          rows: [{ id: "col-1", title: "Guitars", handle: "guitars", total_count: "3" }] as Row[],
          rowCount: 1,
        };
      },
      async end(): Promise<void> {},
    },
  );
  assert.deepEqual(await response.json(), {
    collections: [{ id: "col-1", title: "Guitars", handle: "guitars" }],
    count: 3,
    limit: 5,
    offset: 2,
  });
  assert.deepEqual(values, [5, 2]);
});

test("returns active catalog categories with published product counts", async () => {
  let query = "";
  const response = await handleCatalogCategoriesRequest(
    new Request("https://api.test/store/catalog/categories"),
    {
      async query<Row>(text: string): Promise<{ rows: Row[]; rowCount: number }> {
        query = text;
        return {
          rows: [{
            id: "cat-1",
            handle: "guitars",
            name: "Guitars",
            parent_category_id: null,
            product_count: "4",
          }] as Row[],
          rowCount: 1,
        };
      },
      async end(): Promise<void> {},
    },
  );
  assert.deepEqual(await response.json(), {
    categories: [{
      id: "cat-1",
      handle: "guitars",
      category: "Guitars",
      count: 4,
      parentId: null,
    }],
  });
  assert.match(query, /product_category_product/);
  assert.match(query, /p\.status = 'published'/);
});

test("returns a published collection with its visible products", async () => {
  const response = await handleCollectionRequest(
    new Request("https://api.test/store/collections/guitars"),
    {
      async query<Row>(): Promise<{ rows: Row[]; rowCount: number }> {
        return {
          rows: [{
            id: "col-1", title: "Guitars", handle: "guitars",
            product_id: "prod-1", product_title: "Canary", product_handle: "canary",
            product_subtitle: null, product_description: null, product_thumbnail: null,
            product_status: "published", collection_id: "col-1", variants: [], total_count: 1,
          }] as Row[],
          rowCount: 1,
        };
      },
      async end(): Promise<void> {},
    },
    "guitars",
  );
  assert.deepEqual(await response.json(), {
    collection: { id: "col-1", title: "Guitars", handle: "guitars" },
    products: [{
      id: "prod-1", title: "Canary", handle: "canary", subtitle: null,
      description: null, thumbnail: null, status: "published", collection_id: "col-1",
      created_at: null, metadata: null, variants: [],
    }],
    count: 1,
  });
});
