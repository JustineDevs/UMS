import assert from "node:assert/strict";
import test from "node:test";
import type { CmsComponentDefinition } from "@universal-music-store/platform-data";
import {
  componentCanvasDocument,
  createComponentCanvasPreviewBlock,
} from "./CmsPageBuilder";

const definition: CmsComponentDefinition = {
  id: "promo-banner",
  name: "Promo banner",
  description: "A reusable promotional banner.",
  category: "sections",
  version: 1,
  structure: "section",
  markup: '<section data-cms-node="promo-banner"><p data-cms-prop="title" contenteditable="true"></p></section>',
  styles: ".promo-banner{color:#123456}",
  styleTokens: {},
  props: [
    { key: "title", label: "Title", type: "text", defaultValue: "Default title" },
  ],
  slots: [{ name: "content", label: "Content" }],
  variants: [
    { id: "default", label: "Default", props: { title: "Default variant" } },
    { id: "sale", label: "Sale", props: { title: "Sale variant" } },
  ],
  defaultVariantId: "default",
};

test("preview block construction keeps variant props and slot shape stable", () => {
  assert.deepEqual(createComponentCanvasPreviewBlock(definition, "sale"), {
    id: "canvas-promo-banner-sale",
    type: "promo_banner",
    componentId: "promo-banner",
    variantId: "sale",
    props: { title: "Sale variant" },
    slots: { content: [] },
  });
});

test("canvas document reflects draft props while unchanged inputs stay deterministic", () => {
  const block = createComponentCanvasPreviewBlock(definition, "sale");
  const first = componentCanvasDocument(block, definition);
  const unchanged = componentCanvasDocument(block, definition);
  const draft = componentCanvasDocument(
    { ...block, props: { ...block.props, title: "Draft title" } },
    definition,
  );

  assert.equal(first, unchanged);
  assert.match(first, /Sale variant/);
  assert.match(draft, /Draft title/);
  assert.notEqual(first, draft);
});

test("canvas document keeps untrusted props out of executable HTML contexts", () => {
  const document = componentCanvasDocument(
    {
      ...createComponentCanvasPreviewBlock(definition, "sale"),
      id: "canvas-</script><script>alert(1)</script>",
      props: { title: "</script><script>alert(2)</script>" },
    },
    { ...definition, slots: [{ name: "content", label: "</strong><script>alert(3)</script>" }] },
  );
  assert.ok(!document.includes("<script>alert(1)</script>"));
  assert.ok(!document.includes("<script>alert(2)</script>"));
  assert.ok(document.includes("textContent=String(slot.label||slot.name)"));
  assert.ok(!document.includes("drop.innerHTML='<strong>'"));
});
