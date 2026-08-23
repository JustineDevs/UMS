import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMedusaMetadataPatch,
  EMPTY_CATALOG_METADATA_FIELDS,
  mergeStorefrontProductMetadata,
} from "./catalog-product-metadata";
import { resolveCatalogMediaReferences } from "./catalog-product-media-db";

test("buildMedusaMetadataPatch emits stable Medusa keys for storefront mapper", () => {
  const patch = buildMedusaMetadataPatch({
    ...EMPTY_CATALOG_METADATA_FIELDS,
    mediaIds: ["asset_1", "asset_1", "asset_2"],
    brand: "BrandX",
    videoUrl: "https://example.com/v",
    weightKg: 0.5,
    dimensionsLabel: "10x10",
    material: "cotton",
    lifestyleImageUrl: "https://example.com/l",
    seoDescription: "seo",
    relatedHandlesText: "a,b",
    hotspotsJson: '[{"xPct":1,"yPct":2,"productSlug":"other"}]',
  });
  const keys = Object.keys(patch).sort();
  assert.deepEqual(keys, [
    "brand",
    "dimensions_label",
    "hotspots",
    "lifestyle_image_url",
    "material",
    "media_ids",
    "related_handles",
    "seo_description",
    "video_url",
    "weight_kg",
  ]);
});

test("mergeStorefrontProductMetadata removes cleared structured PDP fields", () => {
  const merged = mergeStorefrontProductMetadata(
    {
      guitar_specs_json: '{"bodyShape":"Dreadnought"}',
      audio_demos_json: "[]",
      trust_content_json: '{"warranty":"1 year"}',
    },
    { ...EMPTY_CATALOG_METADATA_FIELDS },
  );
  assert.equal("guitar_specs_json" in merged, false);
  assert.equal("audio_demos_json" in merged, false);
  assert.equal("trust_content_json" in merged, false);
});

test("catalog media references resolve only live assets owned by the organization", async () => {
  const calls: Record<string, unknown> = {};
  const client = {
    from(table: string) {
      calls.table = table;
      const chain = {
        select(value: string) { calls.select = value; return chain; },
        in(key: string, value: string[]) { calls[key] = value; return chain; },
        eq(key: string, value: string) { calls[key] = value; return chain; },
        is(key: string, value: null) { calls[key] = value; return chain; },
        then(resolve: (value: unknown) => unknown) {
          return resolve({
            data: [
              { id: "asset_2", public_url: "https://cdn.test/2.jpg" },
              { id: "asset_1", public_url: "https://cdn.test/1.jpg" },
            ],
            error: null,
          });
        },
      };
      return chain;
    },
  } as never;

  assert.deepEqual(
    await resolveCatalogMediaReferences(client, ["asset_1", "asset_1", "asset_2"], "org_1"),
    ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg"],
  );
  assert.equal(calls.organization_id, "org_1");
  assert.equal(calls.deleted_at, null);
});

test("catalog media references reject deleted or cross-tenant assets", async () => {
  const client = {
    from() {
      const chain = {
        select() { return chain; },
        in() { return chain; },
        eq() { return chain; },
        is() { return chain; },
        then(resolve: (value: unknown) => unknown) {
          return resolve({ data: [], error: null });
        },
      };
      return chain;
    },
  } as never;
  await assert.rejects(
    resolveCatalogMediaReferences(client, ["asset_missing"], "org_1"),
    /media references are unavailable/,
  );
});
