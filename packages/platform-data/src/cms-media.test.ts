import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCatalogMediaUrlAllowed } from "./cms-media";

describe("catalog media URL policy", () => {
  it("allows public HTTPS and rejects insecure or local targets", () => {
    assert.equal(isCatalogMediaUrlAllowed("https://cdn.example.com/image.webp"), true);
    assert.equal(isCatalogMediaUrlAllowed("http://cdn.example.com/image.webp"), false);
    assert.equal(isCatalogMediaUrlAllowed("https://localhost/image.webp"), false);
    assert.equal(isCatalogMediaUrlAllowed("https://192.168.1.5/image.webp"), false);
  });
});
