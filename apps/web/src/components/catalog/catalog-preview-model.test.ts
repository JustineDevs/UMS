import assert from "node:assert/strict";
import test from "node:test";
import { buildCatalogPreviewModel } from "./catalog-preview-model";

test("buildCatalogPreviewModel normalizes sparse preview input", () => {
  const model = buildCatalogPreviewModel({
    title: " ",
    handle: "",
    description: "",
    status: "draft",
    brand: "",
    currencyCode: "php",
    pricePhp: "-",
    imageUrls: [],
    videoUrls: [],
    categoryLabels: ["", "  "],
    sizes: [],
    colors: [],
  });

  assert.equal(model.title, "Untitled product");
  assert.equal(model.handle, "product-handle");
  assert.equal(model.defaultSize, "One Size");
  assert.equal(model.defaultColor, "Default");
  assert.equal(model.variants.length, 1);
  assert.equal(model.priceLabel, "PHP --");
});

test("buildCatalogPreviewModel preserves previewable media and cartesian variants", () => {
  const model = buildCatalogPreviewModel({
    title: "Weekend Tee",
    handle: "weekend-tee",
    description: "Heavy cotton tee",
    status: "published",
    brand: "Universal Music Store",
    currencyCode: "php",
    pricePhp: "1299",
    imageUrls: [
      "https://cdn.example.com/front.jpg",
      "https://cdn.example.com/back.jpg",
    ],
    videoUrls: ["https://www.youtube.com/watch?v=12345678901"],
    categoryLabels: ["Tees", "Featured", "Tees"],
    sizes: ["S", "M"],
    colors: ["Black", "White"],
  });

  assert.equal(model.media.length, 3);
  assert.deepEqual(model.categoryLabels, ["Tees", "Featured"]);
  assert.equal(model.variants.length, 4);
  assert.equal(model.cardPriceLabel, "PHP 1,299");
  assert.equal(model.brand, "Universal Music Store");
});

test("buildCatalogPreviewModel treats gallery png as image and mp4 as video", () => {
  const model = buildCatalogPreviewModel({
    title: "Test",
    handle: "test",
    description: "",
    status: "draft",
    brand: "",
    currencyCode: "php",
    pricePhp: "1",
    imageUrls: ["https://cdn.example.com/a.jpg"],
    videoUrls: [
      "https://cdn.example.com/extra.png",
      "https://cdn.example.com/promo.mp4",
    ],
    categoryLabels: [],
    sizes: ["One Size"],
    colors: ["Default"],
  });
  assert.equal(model.media.length, 3);
  assert.equal(model.media[0]?.kind, "image");
  assert.equal(model.media[1]?.kind, "image");
  assert.equal(model.media[1]?.label, "Gallery item 1");
  assert.equal(model.media[2]?.kind, "video");
});
