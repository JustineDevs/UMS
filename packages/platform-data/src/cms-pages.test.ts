import assert from "node:assert/strict";
import test from "node:test";
import {
  cmsBlocksToTree,
  cmsTreeToBlocks,
  getCmsPageById,
  getCmsPageBySlugLocalePublic,
  normalizeCmsTree,
  validateCmsPublishTree,
} from "./cms-pages.js";

test("public CMS lookup fails closed without an organization scope", async () => {
  const supabase = {
    from() {
      throw new Error("unscoped query should not execute");
    },
  } as never;
  assert.equal(
    await getCmsPageBySlugLocalePublic(supabase, "home", "en"),
    null,
  );
});

test("publish validation rejects orphan and inconsistent child links", () => {
  const result = validateCmsPublishTree([
    { id: "root", componentId: "layout", parentId: null, children: ["missing"], props: {}, styles: {} },
  ]);
  assert.equal(result.ok, false);
});

test("normalizes persisted trees without dropping unknown nodes", () => {
  const tree = normalizeCmsTree([
    { id: "root", componentId: "future-layout", parentId: null, slot: null, props: { keep: true }, children: ["child", "missing"] },
    { id: "child", componentId: "future-widget", parentId: "root", slot: "content", props: {}, children: [] },
    { id: "orphan", componentId: "future-orphan", parentId: "missing", slot: "x", props: {}, children: [] },
  ]);
  assert.deepEqual(tree.map((node) => [node.id, node.parentId]), [["root", null], ["child", "root"], ["orphan", null]]);
  assert.deepEqual(tree[0]?.children, ["child"]);
  assert.equal(cmsTreeToBlocks(tree)[0]?.componentId, "future-layout");
  assert.equal(cmsTreeToBlocks(tree)[0]?.slots?.content[0]?.componentId, "future-widget");
});

test("canonical CMS tree round-trips nested slots without losing block metadata", () => {
  const blocks = [{
    id: "hero_1",
    type: "hero",
    componentId: "hero",
    variantId: "split",
    props: { title: "Launch" },
    styleOverrides: { "--cms-accent": "var(--color-primary)" },
    slots: {
      actions: [{
        id: "cta_1",
        componentId: "cta-row",
        variantId: "outline",
        props: { label: "Shop" },
        slots: { icon: [{ id: "icon_1", componentId: "icon", props: {}, slots: {} }] },
      }],
    },
  }];
  const tree = cmsBlocksToTree(blocks);
  const roundTrip = cmsTreeToBlocks(tree);
  assert.equal(roundTrip[0].type, "hero");
  assert.equal(roundTrip[0].variantId, "split");
  assert.deepEqual(roundTrip[0].props, { title: "Launch" });
  assert.equal(roundTrip[0].slots?.actions[0].componentId, "cta-row");
  assert.equal(roundTrip[0].slots?.actions[0].slots.icon[0].componentId, "icon");
  assert.equal(tree.find((node) => node.id === "icon_1")?.parentId, "cta_1");
});

test("unsupported CMS tree nodes stay identifiable instead of becoming rich text", () => {
  const tree = normalizeCmsTree([
    {
      id: "future_1",
      componentId: "future-component",
      blockType: "future_block",
      parentId: null,
      slot: null,
      props: { source: "future" },
      styles: {},
      children: [],
    },
  ]);

  const [block] = cmsTreeToBlocks(tree);
  assert.equal(block.type, "future_block");
  assert.equal(block.componentId, "future-component");
  assert.deepEqual(block.props, { source: "future" });
});

test("getCmsPageById preserves modular component slots and variants", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "cms_pages");
      return {
        select(columns: string) {
          assert.equal(columns, "*");
          return {
            eq(column: string, id: string) {
              assert.equal(column, "id");
              assert.equal(id, "page_1");
              return {
                async maybeSingle() {
                  return {
                    error: null,
                    data: {
                      id: "page_1",
                      slug: "home",
                      locale: "en",
                      page_type: "landing",
                      title: "Home",
                      body: "",
                      blocks: [
                        {
                          id: "hero_1",
                          type: "hero",
                          componentId: "hero",
                          variantId: "split",
                          props: { title: "Launch" },
                          styleOverrides: {
                            "--cms-accent": "var(--color-primary)",
                            ignored: 42,
                          },
                          slots: {
                            actions: [
                              {
                                id: "cta_1",
                                componentId: "cta-row",
                                variantId: "outline",
                                props: { label: "Shop", href: "/shop" },
                                slots: {},
                              },
                            ],
                          },
                        },
                      ],
                      status: "draft",
                      published_at: null,
                      scheduled_publish_at: null,
                      preview_token: null,
                      meta_title: null,
                      meta_description: null,
                      canonical_url: null,
                      og_image_url: null,
                      json_ld: null,
                      version: 1,
                      created_at: "2026-08-11T00:00:00.000Z",
                      updated_at: "2026-08-11T00:00:00.000Z",
                      parent_slug: null,
                      breadcrumb_label: null,
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  const page = await getCmsPageById(supabase as never, "page_1");
  const block = page?.blocks[0];
  const cta = block?.slots?.actions?.[0];

  assert.equal(block?.componentId, "hero");
  assert.equal(block?.variantId, "split");
  assert.deepEqual(block?.styleOverrides, {
    "--cms-accent": "var(--color-primary)",
  });
  assert.equal(cta?.componentId, "cta-row");
  assert.equal(cta?.variantId, "outline");
  assert.deepEqual(cta?.props, { label: "Shop", href: "/shop" });
});
