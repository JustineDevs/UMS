import assert from "node:assert/strict";
import test from "node:test";
import { catalogMediaUrlsFromProducts } from "./catalog-media-urls";

test("extracts unique product thumbnails and image URLs", () => {
  assert.deepEqual(
    catalogMediaUrlsFromProducts([
      {
        thumbnail: " https://cdn.example/a.jpg ",
        images: [{ url: "https://cdn.example/b.jpg" }, { url: "https://cdn.example/a.jpg" }],
      },
      { thumbnail: "https://cdn.example/c.jpg", images: [null, { url: "" }] },
      null,
      { thumbnail: 42 },
    ]),
    [
      "https://cdn.example/a.jpg",
      "https://cdn.example/b.jpg",
      "https://cdn.example/c.jpg",
    ],
  );
});
