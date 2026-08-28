import assert from "node:assert/strict";
import test from "node:test";
import { parseHomePreviewMessage } from "./home-preview-message";

test("accepts a typed canonical home preview tree", () => {
  const message = parseHomePreviewMessage({
    source: "cms-builder-draft",
    mode: "home",
    tree: [{
      id: "home-hero",
      componentId: "hero",
      parentId: null,
      slot: null,
      props: { title: "New title" },
      styles: {},
      children: [],
    }],
  });

  assert.equal(message?.tree?.[0]?.id, "home-hero");
});

test("rejects malformed or wrong-mode preview messages", () => {
  assert.equal(parseHomePreviewMessage({ source: "cms-builder-draft", mode: "page", tree: [] }), null);
  assert.equal(parseHomePreviewMessage({ source: "cms-builder-draft", mode: "home", tree: [{ id: "missing" }] }), null);
});

test("accepts the legacy block compatibility payload", () => {
  const message = parseHomePreviewMessage({
    source: "cms-builder-draft",
    mode: "home",
    blocks: [{ id: "home-hero", type: "hero", props: { title: "New title" } }],
  });

  assert.equal(message?.blocks?.[0]?.type, "hero");
});
