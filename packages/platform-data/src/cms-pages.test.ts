import assert from "node:assert/strict";
import test from "node:test";
import { getCmsPageById } from "./cms-pages.js";

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
