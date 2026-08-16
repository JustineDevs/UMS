import assert from "node:assert/strict";
import test from "node:test";
import { cmsPagePreviewUrl } from "./cms-preview-url.js";

test("CMS page preview keeps the storefront route and adds the draft token", () => {
  assert.equal(
    cmsPagePreviewUrl("https://storefront.test/p/about", " draft-token "),
    "https://storefront.test/p/about?preview=draft-token",
  );
});

test("CMS page preview leaves the public route unchanged without a token", () => {
  assert.equal(cmsPagePreviewUrl("https://storefront.test/p/about", "  "), "https://storefront.test/p/about");
});
