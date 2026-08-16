import assert from "node:assert/strict";
import test from "node:test";
import { cmsPageSchema } from "./cms-route-contracts.js";
import { cmsPreviewMessageSchema } from "./cms-component-contract.js";
import { cmsComponentDefinitionSchema } from "./cms-component-contract.js";

test("cms page contract preserves deeply nested component trees", () => {
  const parsed = cmsPageSchema.safeParse({
    id: "11111111-1111-4111-8111-111111111111",
    slug: "nested-page",
    expectedVersion: 4,
    blocks: [
      {
        id: "hero",
        type: "hero",
        componentId: "hero",
        props: { title: "Launch" },
        styleOverrides: { gap: "1rem" },
        slots: {
          actions: [
            {
              id: "action",
              componentId: "cta-row",
              props: { label: "Shop" },
              slots: {
                icon: [
                  {
                    id: "icon",
                    componentId: "image",
                    props: { src: "/icon.svg" },
                    slots: {},
                    lockedStructure: true,
                  },
                ],
              },
            },
          ],
        },
      },
    ],
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.expectedVersion, 4);
  assert.match(JSON.stringify(parsed.data), /"lockedStructure":true/);
});

test("cms page contract rejects unknown component instance fields", () => {
  const parsed = cmsPageSchema.safeParse({
    slug: "invalid-page",
    blocks: [
      {
        id: "hero",
        type: "hero",
        props: {},
        slots: {
          actions: [
            {
              id: "action",
              componentId: "cta-row",
              props: {},
              slots: {},
              notPersisted: true,
            },
          ],
        },
      },
    ],
  });

  assert.equal(parsed.success, false);
});

test("cms page contract accepts a canonical tree node", () => {
  const parsed = cmsPageSchema.safeParse({
    slug: "tree-page",
    tree: [
      {
        id: "future_1",
        componentId: "future-component",
        parentId: null,
        slot: null,
        props: { source: "future" },
        styles: {},
        children: [],
        blockType: "future_block",
      },
    ],
  });

  assert.equal(parsed.success, true);
});

test("cms page contract accepts replayable mutation commands", () => {
  const parsed = cmsPageSchema.safeParse({
    slug: "mutation-page",
    expectedVersion: 2,
    tree: [],
    mutations: [
      { type: "set-style", nodeId: "hero", key: "gap", before: "1rem", after: "2rem" },
      { type: "move", nodeId: "cta", parentId: "hero", slot: "actions", index: 0 },
    ],
  });
  assert.equal(parsed.success, true);
});

test("preview contract accepts stable geometry and rejects malformed selection messages", () => {
  assert.equal(cmsPreviewMessageSchema.safeParse({
    source: "cms-builder",
    id: "hero",
    blockId: "hero",
    label: "Hero",
    rect: { x: 0, y: 12, width: 640, height: 240 },
  }).success, true);
  assert.equal(cmsPreviewMessageSchema.safeParse({
    source: "cms-builder",
    id: "hero",
    rect: { x: 0, y: 12, width: -1, height: 240 },
  }).success, false);
});

test("component canvas contract accepts sanitized source and rejects executable source", () => {
  const base = {
    id: "visual-card",
    name: "Visual card",
    description: "Reusable card",
    category: "Content",
    version: 1,
    structure: "article",
    styleTokens: {},
    props: [],
    slots: [],
    variants: [{ id: "default", label: "Default" }],
    markup: "<article data-cms-node=\"card\">Card</article>",
    styles: ".card { color: #111827; }",
  };
  assert.equal(cmsComponentDefinitionSchema.safeParse(base).success, true);
  assert.equal(cmsComponentDefinitionSchema.safeParse({ ...base, markup: "<script>alert(1)</script>" }).success, false);
  assert.equal(cmsComponentDefinitionSchema.safeParse({ ...base, styles: "@import url(https://evil.test/x.css);" }).success, false);
});
