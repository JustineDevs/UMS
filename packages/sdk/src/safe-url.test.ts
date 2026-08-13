import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeSameOriginUrl,
  sanitizeTrustedPublicUrl,
} from "./safe-url.js";

test("accepts same-origin paths and removes fragments", () => {
  assert.equal(
    sanitizeSameOriginUrl("/admin/catalog/media?folder=abc#unsafe", "https://admin.example"),
    "https://admin.example/admin/catalog/media?folder=abc",
  );
});

test("rejects script schemes, credentials, and cross-origin redirects", () => {
  assert.equal(sanitizeSameOriginUrl("javascript:alert(1)", "https://admin.example"), null);
  assert.equal(sanitizeSameOriginUrl("https://evil.example/admin", "https://admin.example"), null);
  assert.equal(sanitizeTrustedPublicUrl("https://user:pass@cdn.example/a", ["https://cdn.example"]), null);
});

test("requires HTTPS for trusted public assets", () => {
  assert.equal(sanitizeTrustedPublicUrl("http://cdn.example/a", ["http://cdn.example"]), null);
  assert.equal(
    sanitizeTrustedPublicUrl("https://cdn.example/assets/a.png", ["https://cdn.example"]),
    "https://cdn.example/assets/a.png",
  );
});
