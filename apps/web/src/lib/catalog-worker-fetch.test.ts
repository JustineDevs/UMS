import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProductBySlug,
  fetchWorkerProducts,
  fetchProductsPage,
  mapWorkerCatalogProduct,
} from "./catalog-worker-fetch";

test("maps a valid Worker product into the storefront product contract", () => {
  const product = mapWorkerCatalogProduct({
    id: "prod_1",
    title: "Studio Guitar",
    handle: "studio-guitar",
    description: "A test product",
    variants: [
      {
        id: "variant_1",
        title: "Natural",
        calculated_price: { calculated_amount: 129900 },
      },
    ],
  });

  assert.equal(product?.id, "prod_1");
  assert.equal(product?.slug, "studio-guitar");
  assert.equal(product?.variants[0]?.id, "variant_1");
});

test("does not fall back to the retired Medusa runtime when Worker URL is absent", async () => {
  const previousApiUrl = process.env.API_URL;
  delete process.env.API_URL;

  try {
    const page = await fetchProductsPage(12);
    const product = await fetchProductBySlug("studio-guitar");

    assert.equal(page.kind, "misconfigured");
    assert.match(page.detail, /API_URL/);
    assert.equal(product.kind, "misconfigured");
    assert.match(product.detail, /API_URL/);
  } finally {
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
  }
});

test("rejects a Worker product whose handle does not match the requested PDP slug", async () => {
  const previousApiUrl = process.env.API_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        product: {
          id: "prod_wrong",
          title: "Wrong product",
          handle: "different-product",
          variants: [{ id: "variant_wrong", calculated_price: { calculated_amount: 129900 } }],
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const result = await fetchProductBySlug("requested-product");
    assert.equal(result.kind, "not_found");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
  }
});

test("forwards every server-side catalog filter to the Worker", async () => {
  const previousApiUrl = process.env.API_URL;
  const previousFetch = globalThis.fetch;
  process.env.API_URL = "https://worker.test";
  let requestUrl = "";
  globalThis.fetch = async (input) => {
    requestUrl = String(input);
    return new Response(JSON.stringify({ products: [], count: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const result = await fetchWorkerProducts(20, {
      category: "guitars",
      type: "Electric",
      finish: "Natural",
      brand: "Yamaha",
      pickupConfig: "HSS",
      bodyWood: "Mahogany",
      condition: "New",
      skillLevel: "Beginner",
      shippingSpeed: "Express",
      minPrice: 1000,
      maxPrice: 5000,
      sort: "price_asc",
      q: "strat",
    });

    assert.equal(result.kind, "ok");
    const params = new URL(requestUrl).searchParams;
    assert.equal(params.get("category"), "guitars");
    assert.equal(params.get("limit"), "20");
    assert.equal(params.get("type"), "Electric");
    assert.equal(params.get("finish"), "Natural");
    assert.equal(params.get("brand"), "Yamaha");
    assert.equal(params.get("pickupConfig"), "HSS");
    assert.equal(params.get("bodyWood"), "Mahogany");
    assert.equal(params.get("condition"), "New");
    assert.equal(params.get("skillLevel"), "Beginner");
    assert.equal(params.get("shippingSpeed"), "Express");
    assert.equal(params.get("sort"), "price_asc");
  } finally {
    globalThis.fetch = previousFetch;
    if (previousApiUrl === undefined) delete process.env.API_URL;
    else process.env.API_URL = previousApiUrl;
  }
});

test("maps variant metadata over product metadata for instrument filters", () => {
  const product = mapWorkerCatalogProduct({
    id: "prod_2",
    title: "Metadata Guitar",
    handle: "metadata-guitar",
    metadata: { brand: "Yamaha", condition: "Used" },
    variants: [{
      id: "variant_2",
      metadata: { condition: "New", pickup_config: "HSS" },
      calculated_price: { calculated_amount: 129900, currency_code: "php" },
    }],
  });

  assert.equal(product?.variants[0]?.condition, "New");
  assert.equal(product?.variants[0]?.pickupConfig, "HSS");
});
