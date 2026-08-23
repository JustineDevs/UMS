import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyCmsMediaUrls,
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
