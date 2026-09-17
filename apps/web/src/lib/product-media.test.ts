import test from "node:test";
import assert from "node:assert/strict";
import {
  effectiveGallerySlideKind,
  urlLooksLikeRasterImage,
} from "./product-media";

test("urlLooksLikeRasterImage detects Supabase image paths", () => {
  assert.equal(
    urlLooksLikeRasterImage(
      "https://x.supabase.co/storage/v1/object/public/catalog/products/prod_abc/photo.webp",
    ),
    true,
  );
  assert.equal(
    urlLooksLikeRasterImage(
      "https://x.supabase.co/storage/v1/object/public/catalog/p/v.mp4",
    ),
    false,
  );
});

test("effectiveGallerySlideKind treats mis-tagged image URLs as image", () => {
  assert.equal(
    effectiveGallerySlideKind({
      kind: "video",
      url: "https://cdn.example.com/a/b/c.png?token=1",
    }),
    "image",
  );
});
