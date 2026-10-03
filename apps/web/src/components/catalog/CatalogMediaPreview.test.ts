import assert from "node:assert/strict";
import test from "node:test";
import { inferCatalogMediaMimeType } from "./catalog-media-mime";

test("preserves a declared catalog media type", () => {
  assert.equal(
    inferCatalogMediaMimeType("https://cdn.example.test/asset", "image/webp"),
    "image/webp",
  );
});

test("infers image types from extensionless Unsplash URLs", () => {
  assert.equal(
    inferCatalogMediaMimeType("https://images.unsplash.com/photo-123?w=1200&q=85", null),
    "image/jpeg",
  );
  assert.equal(
    inferCatalogMediaMimeType("https://images.unsplash.com/photo-123?fm=webp", null),
    "image/webp",
  );
});

test("infers common file extensions when the database type is missing", () => {
  assert.equal(inferCatalogMediaMimeType("https://cdn.example.test/asset.png", null), "image/png");
  assert.equal(inferCatalogMediaMimeType("https://cdn.example.test/asset.mp4", null), "video/*");
});
