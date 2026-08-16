import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_STOREFRONT_HOME_PAYLOAD,
  mergeStorefrontHomePayload,
} from "./storefront-home-cms.js";

describe("mergeStorefrontHomePayload", () => {
  it("returns defaults for empty input", () => {
    const m = mergeStorefrontHomePayload(null);
    assert.equal(m.hero.line1, DEFAULT_STOREFRONT_HOME_PAYLOAD.hero.line1);
    assert.equal(m.tiles[0].title, DEFAULT_STOREFRONT_HOME_PAYLOAD.tiles[0].title);
    assert.equal(m.hero.style.headlineFont, DEFAULT_STOREFRONT_HOME_PAYLOAD.hero.style.headlineFont);
  });

  it("merges partial hero and preserves the editable tile collection", () => {
    const m = mergeStorefrontHomePayload({
      hero: { line1: "CUSTOM", style: { headlineSize: "compact", contentWidth: "extra" } },
      tiles: [{ title: "A" }, { href: "/x" }],
    });
    assert.equal(m.hero.line1, "CUSTOM");
    assert.equal(m.hero.line2, DEFAULT_STOREFRONT_HOME_PAYLOAD.hero.line2);
    assert.equal(m.hero.style.headlineSize, "compact");
    assert.equal(m.hero.style.contentWidth, "extra");
    assert.equal(m.tiles[0].title, "A");
    assert.equal(m.tiles[1].href, "/x");
    assert.equal(m.tiles.length, 2);
  });

  it("preserves additional category tiles beyond the default layout", () => {
    const m = mergeStorefrontHomePayload({
      tiles: [
        ...DEFAULT_STOREFRONT_HOME_PAYLOAD.tiles,
        { title: "Studio", href: "/shop?category=Studio", imageUrl: "", linkLabel: "Shop", variant: "small" },
      ],
    });
    assert.equal(m.tiles.length, 4);
    assert.equal(m.tiles[3].title, "Studio");
  });

  it("drops stale external image URLs from home payloads", () => {
    const m = mergeStorefrontHomePayload({
      hero: {
        imageUrl:
          "https://scontent.fmnl7-2.fna.fbcdn.net/v/t39.30808-6/example.jpg",
      },
      tiles: [
        {
          imageUrl:
            "https://medusa-public-images.s3.eu-west-1.amazonaws.com/guitar-black-front.png",
        },
      ],
    });
    assert.equal(m.hero.imageUrl, "");
    assert.equal(m.tiles[0].imageUrl, "");
  });

  it("keeps safe section sizing metadata for the visual editor", () => {
    const m = mergeStorefrontHomePayload({
      hero: { layout: { maxWidth: "1200px", paddingBlock: "clamp(2rem, 6vw, 5rem)" } },
      sectionLayout: {
        latest: { minHeight: "480px", paddingInline: "24px" },
        newsletter: { maxWidth: "48rem", background: "url(evil)" },
      },
    });
    assert.equal(m.hero.layout?.maxWidth, "1200px");
    assert.equal(m.hero.layout?.paddingBlock, "clamp(2rem, 6vw, 5rem)");
    assert.equal(m.sectionLayout?.latest?.minHeight, "480px");
    assert.equal(m.sectionLayout?.newsletter?.maxWidth, "48rem");
    assert.equal("background" in (m.sectionLayout?.newsletter ?? {}), false);
  });
});
