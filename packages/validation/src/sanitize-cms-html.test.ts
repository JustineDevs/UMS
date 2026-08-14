import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCmsHtml } from "./sanitize-cms-html";

test("sanitizeCmsHtml removes script tags", () => {
  const out = sanitizeCmsHtml('<p>Hello</p><script>alert(1)</script>');
  assert.ok(!out.toLowerCase().includes("script"));
  assert.ok(out.includes("Hello"));
});

test("sanitizeCmsHtml returns empty for empty input", () => {
  assert.equal(sanitizeCmsHtml(""), "");
});
