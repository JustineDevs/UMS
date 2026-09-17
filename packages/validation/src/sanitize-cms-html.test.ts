import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeCmsHtml } from "./sanitize-cms-html";
import { applyCmsDomOverrides } from "./cms-dom-overrides";

test("sanitizeCmsHtml removes script tags", () => {
  const out = sanitizeCmsHtml('<p>Hello</p><script>alert(1)</script>');
  assert.ok(!out.toLowerCase().includes("script"));
  assert.ok(out.includes("Hello"));
});

test("sanitizeCmsHtml returns empty for empty input", () => {
  assert.equal(sanitizeCmsHtml(""), "");
});

test("applyCmsDomOverrides preserves Vvveb child edits by relative path", () => {
  const out = applyCmsDomOverrides(
    '<h2>Original</h2><a href="/old">Link</a><img src="/old.jpg">',
    {
      "__visual_path:0": { textContent: "Updated" },
      "__visual_path:1": { href: "/new" },
      "__visual_path:2": { src: "/new.jpg", "style.width": "240px" },
    },
  );
  assert.match(out, /<h2>Updated<\/h2>/);
  assert.match(out, /href="\/new"/);
  assert.match(out, /src="\/new\.jpg"/);
  assert.match(out, /style="width:240px"/);
  const unsafe = applyCmsDomOverrides('<a href="/old">Link</a>', { "__visual_path:0": { href: "javascript:alert(1)" } });
  assert.ok(!unsafe.includes("javascript:"));
});
