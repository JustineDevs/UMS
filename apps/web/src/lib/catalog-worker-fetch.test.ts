import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchProductBySlug,
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
