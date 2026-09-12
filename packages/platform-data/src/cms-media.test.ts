import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCmsMediaUrls,
  findCmsMediaReferences,
  isCatalogMediaUrlAllowed,
  mediaIdPropKey,
  stripResolvedCmsMediaUrls,
} from "./cms-media";

describe("catalog media URL policy", () => {
  it("allows public HTTPS and rejects insecure or local targets", () => {
    assert.equal(isCatalogMediaUrlAllowed("https://cdn.example.com/image.webp"), true);
    assert.equal(isCatalogMediaUrlAllowed("http://cdn.example.com/image.webp"), false);
    assert.equal(isCatalogMediaUrlAllowed("https://localhost/image.webp"), false);
    assert.equal(isCatalogMediaUrlAllowed("https://192.168.1.5/image.webp"), false);
  });
});

it("uses media IDs as the canonical CMS prop and resolves the legacy URL at read time", () => {
  assert.equal(mediaIdPropKey("imageUrl"), "imageMediaId");
  const stored = stripResolvedCmsMediaUrls({ props: { imageMediaId: "asset-1", imageUrl: "old" } });
  assert.deepEqual(stored, { props: { imageMediaId: "asset-1" } });
  assert.deepEqual(
    applyCmsMediaUrls(stored, new Map([["asset-1", "https://cdn.example/image.webp"]])),
    { props: { imageMediaId: "asset-1", imageUrl: "https://cdn.example/image.webp" } },
  );
});

it("scopes storefront home media references to the requested organization", async () => {
  const filters: Array<{ table: string; column: string; value: string }> = [];
  const client = {
    from(table: string) {
      const chain = {
        select() {
          return chain;
        },
        eq(column: string, value: string) {
          filters.push({ table, column, value });
          return chain;
        },
        then(
          resolve: (value: { data: never[] }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({ data: [] as never[] }).then(resolve, reject);
        },
      };
      return chain;
    },
  };

  await findCmsMediaReferences(client as never, "https://cdn.example/image.webp", "org-2");

  assert.deepEqual(
    filters.find((filter) => filter.table === "storefront_home_content"),
    { table: "storefront_home_content", column: "organization_id", value: "org-2" },
  );
});
