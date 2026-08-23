import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  catalogProductFromMedusaRaw,
  medusaProductRawHasSellableVariant,
  medusaVariantRawIsSellable,
} from "./medusa-catalog-mapper";

describe("medusaVariantRawIsSellable", () => {
  it("treats manage_inventory false as always sellable", () => {
    assert.equal(
      medusaVariantRawIsSellable({
        manage_inventory: false,
        inventory_quantity: 0,
      }),
      true,
    );
  });

  it("requires positive inventory_quantity when manage_inventory true", () => {
    assert.equal(
      medusaVariantRawIsSellable({
        manage_inventory: true,
        inventory_quantity: 3,
      }),
      true,
    );
    assert.equal(
      medusaVariantRawIsSellable({
        manage_inventory: true,
        inventory_quantity: 0,
      }),
      false,
    );
    assert.equal(
      medusaVariantRawIsSellable({
        manage_inventory: true,
        inventory_quantity: null,
      }),
      true,
    );
    assert.equal(
      medusaVariantRawIsSellable({
        manage_inventory: true,
      }),
      true,
    );
  });

  it("is optimistic when manage_inventory is undefined and quantity absent", () => {
    assert.equal(medusaVariantRawIsSellable({}), true);
  });

  it("is optimistic when manage_inventory is true but quantity is omitted in the Store API payload", () => {
    assert.equal(
      medusaVariantRawIsSellable({ manage_inventory: true }),
      true,
    );
  });

  it("uses numeric quantity when present even if manage_inventory undefined", () => {
    assert.equal(
      medusaVariantRawIsSellable({ inventory_quantity: 0 }),
      false,
    );
    assert.equal(
      medusaVariantRawIsSellable({ inventory_quantity: 1 }),
      true,
    );
  });

  it("uses numeric quantity when manage_inventory is null", () => {
    assert.equal(
      medusaVariantRawIsSellable({ manage_inventory: null, inventory_quantity: 2 }),
      true,
    );
    assert.equal(
      medusaVariantRawIsSellable({ manage_inventory: null, inventory_quantity: 0 }),
      false,
    );
  });
});

describe("medusaProductRawHasSellableVariant", () => {
  it("is true when variants are missing stock quantities", () => {
    assert.equal(
      medusaProductRawHasSellableVariant({
        variants: [
          { manage_inventory: true, inventory_quantity: null },
          { manage_inventory: true, inventory_quantity: null },
        ],
      }),
      true,
    );
  });

  it("is true when any variant is sellable", () => {
    assert.equal(
      medusaProductRawHasSellableVariant({
        variants: [
          { manage_inventory: true, inventory_quantity: 0 },
          { manage_inventory: true, inventory_quantity: 2 },
        ],
      }),
      true,
    );
  });
});

describe("catalogProductFromMedusaRaw", () => {
  it("preserves catalog image alt text in the PDP gallery", () => {
    const p = catalogProductFromMedusaRaw({
      id: "prod_gallery",
      title: "Studio Guitar",
      images: [{ id: "img_1", url: "https://cdn.example.test/guitar.jpg", alt_text: "Natural finish guitar front" }],
      variants: [{ id: "var_gallery", manage_inventory: false }],
    });
    assert.ok(p);
    assert.equal(p!.images[0]?.altText, "Natural finish guitar front");
    assert.deepEqual(p!.gallerySlides[0], {
      kind: "image",
      url: "https://cdn.example.test/guitar.jpg",
      altText: "Natural finish guitar front",
    });
  });

  it("maps typed product metadata without inventing missing fields", () => {
    const p = catalogProductFromMedusaRaw({
      id: "prod_audio",
      title: "Studio Guitar",
      handle: "studio-guitar",
      metadata: {
        guitar_specs_json: JSON.stringify({ bodyShape: "Dreadnought", fretCount: 20 }),
        audio_demos_json: JSON.stringify([{ url: "/media/clean.mp3", title: "Clean tone" }]),
        trust_content_json: JSON.stringify({ conditionGrade: "New", includedAccessories: ["Gig bag"] }),
      },
      variants: [{
        id: "var_audio",
        manage_inventory: false,
        calculated_price: { calculated_amount: 10000 },
      }],
    });
    assert.ok(p);
    assert.deepEqual(p!.guitarSpecs, { bodyShape: "Dreadnought", fretCount: 20 });
    assert.deepEqual(p!.audioDemos, [{ url: "/media/clean.mp3", title: "Clean tone" }]);
    assert.deepEqual(p!.trustContent, { conditionGrade: "New", includedAccessories: ["Gig bag"] });
  });

  it("returns null when every variant is out of stock", () => {
    const raw = {
      id: "prod_1",
      title: "Guitar",
      handle: "guitar",
      variants: [
        {
          id: "var_1",
          manage_inventory: true,
          inventory_quantity: 0,
          options: [],
          calculated_price: { calculated_amount: 10000 },
        },
      ],
    };
    assert.equal(catalogProductFromMedusaRaw(raw), null);
  });

  it("keeps only in-stock variants", () => {
    const raw = {
      id: "prod_1",
      title: "Guitar",
      handle: "guitar",
      variants: [
        {
          id: "var_oos",
          manage_inventory: true,
          inventory_quantity: 0,
          options: [{ option: { title: "Type" }, value: "Electric" }],
          calculated_price: { calculated_amount: 10000 },
        },
        {
          id: "var_ok",
          manage_inventory: true,
          inventory_quantity: 5,
          options: [{ option: { title: "Type" }, value: "Acoustic" }],
          calculated_price: { calculated_amount: 10000 },
        },
      ],
    };
    const p = catalogProductFromMedusaRaw(raw);
    assert.ok(p);
    assert.equal(p!.variants.length, 1);
    assert.equal(p!.variants[0]!.id, "var_ok");
  });
});
