import assert from "node:assert/strict";
import test from "node:test";

import {
  collectCommerceProductLookupRows,
  filterCommerceProductLookupRows,
  parseCommerceProductLookupParams,
} from "./commerce-product-lookup";

test("parseCommerceProductLookupParams prefers category_id and keeps legacy collection_id fallback", () => {
  const current = parseCommerceProductLookupParams(
    new URLSearchParams("q=tee&category_id=cat_123&published=true&limit=120"),
  );
  assert.deepEqual(current, {
    query: "tee",
    categoryId: "cat_123",
    published: "published",
    limit: 80,
  });

  const legacy = parseCommerceProductLookupParams(
    new URLSearchParams("collection_id=cat_legacy&published=false"),
  );
  assert.deepEqual(legacy, {
    categoryId: "cat_legacy",
    published: "not_published",
    limit: 40,
  });
});

test("filterCommerceProductLookupRows applies category and published filters consistently", () => {
  const rows = [
    {
      id: "prod_1",
      title: "Alpha",
      handle: "alpha",
      sku: "SKU-1",
      status: "published",
      thumbnail_url: null,
      category_ids: ["cat_a", "cat_b"],
    },
    {
      id: "prod_2",
      title: "Beta",
      handle: "beta",
      sku: "SKU-2",
      status: "draft",
      thumbnail_url: null,
      category_ids: ["cat_b"],
    },
    {
      id: "prod_3",
      title: "Gamma",
      handle: "gamma",
      sku: "SKU-3",
      status: "published",
      thumbnail_url: null,
      category_ids: ["cat_c"],
    },
  ];

  const publishedInCatB = filterCommerceProductLookupRows(rows, {
    categoryId: "cat_b",
    published: "published",
    limit: 40,
  });
  assert.deepEqual(
    publishedInCatB.map((row) => row.id),
    ["prod_1"],
  );

  const notPublishedInCatB = filterCommerceProductLookupRows(rows, {
    categoryId: "cat_b",
    published: "not_published",
    limit: 40,
  });
  assert.deepEqual(
    notPublishedInCatB.map((row) => row.id),
    ["prod_2"],
  );
});

test("collectCommerceProductLookupRows keeps paging when client-side category filtering needs more results", async () => {
  const calls: number[] = [];
  const rows = await collectCommerceProductLookupRows(
    { categoryId: "cat_b", limit: 1 },
    async ({ offset }) => {
      calls.push(offset);
      if (offset === 0) {
        return [
          {
            id: "prod_1",
            title: "Alpha",
            handle: "alpha",
            sku: "SKU-1",
            status: "published",
            thumbnail_url: null,
            category_ids: ["cat_a"],
          },
        ];
      }
      return [
        {
          id: "prod_2",
          title: "Beta",
          handle: "beta",
          sku: "SKU-2",
          status: "published",
          thumbnail_url: null,
          category_ids: ["cat_b"],
        },
      ];
    },
  );

  assert.deepEqual(calls, [0, 1]);
  assert.deepEqual(rows.map((row) => row.id), ["prod_2"]);
});
