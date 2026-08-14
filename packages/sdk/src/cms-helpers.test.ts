import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCmsPreviewUrl, normalizeCmsLocale } from "./cms-helpers.js";

describe("cms-helpers", () => {
  it("buildCmsPreviewUrl encodes query", () => {
    const u = buildCmsPreviewUrl({
      siteOrigin: "https://example.com",
      slug: "a/b",
      locale: "en",
      token: "t&1",
      kind: "blog",
    });
    assert.ok(u.startsWith("https://example.com/api/cms/preview?"));
    assert.ok(u.includes("kind=blog"));
    assert.ok(u.includes(encodeURIComponent("a/b")));
    assert.ok(u.includes(encodeURIComponent("t&1")));
  });

  it("normalizeCmsLocale maps default and preserves tag", () => {
    const fallback = normalizeCmsLocale(null);
    assert.equal(normalizeCmsLocale("default"), fallback);
    assert.equal(normalizeCmsLocale("tl"), "tl");
  });
});
