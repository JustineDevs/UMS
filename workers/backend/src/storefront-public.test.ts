import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import {
  handleStorefrontHomeRequest,
  handleStorefrontMetadataRequest,
} from "./storefront-public.ts";

function database(
  query: WorkerDatabaseClient["query"],
): WorkerDatabaseClient {
  return { query, async end() {} };
}

test("public metadata reads the bounded Worker projection", async () => {
  let sql = "";
  const response = await handleStorefrontMetadataRequest(
    new Request("https://worker.test/storefront/public-metadata"),
    database(async (text, values) => {
      sql = text;
      assert.deepEqual(values, ["default"]);
      return { rows: [{ payload: { storeName: " UVS " } }], rowCount: 1 };
    }),
  );
  assert.equal(response.status, 200);
  assert.match(sql, /SELECT payload FROM public\.storefront_public_metadata/);
  assert.deepEqual(await response.json(), { metadata: { storeName: " UVS " } });
});

test("published CMS home content is preferred over the legacy home row", async () => {
  const queries: string[] = [];
  const response = await handleStorefrontHomeRequest(
    new Request("https://worker.test/storefront/home"),
    database(async (text) => {
      queries.push(text);
      if (text.includes("FROM public.cms_pages")) {
        return {
          rows: [
            {
              id: "page-1",
              organization_id: "org-1",
              slug: "home",
              locale: "en",
              page_type: "home",
              title: "Home",
              body: "",
              blocks: [],
              tree: [{ id: "root", type: "section", props: {}, children: [] }],
              status: "published",
              published_at: null,
              scheduled_publish_at: null,
              meta_title: null,
              meta_description: null,
              canonical_url: null,
              og_image_url: null,
              json_ld: null,
              version: 1,
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
          rowCount: 1,
        };
      }
      throw new Error("legacy row must not be queried");
    }),
    "org-1",
  );
  assert.equal(response.status, 200);
  const body = (await response.json()) as { page?: { slug?: string } };
  assert.equal(body.page?.slug, "home");
  assert.equal(queries.length, 1);
});

test("home falls back to the legacy payload when no published page exists", async () => {
  const response = await handleStorefrontHomeRequest(
    new Request("https://worker.test/storefront/home"),
    database(async (text) => {
      if (text.includes("FROM public.cms_pages")) return { rows: [], rowCount: 0 };
      return { rows: [{ payload: { hero: { line1: "Legacy" } } }], rowCount: 1 };
    }),
    "org-1",
  );
  assert.deepEqual(await response.json(), { home: { hero: { line1: "Legacy" } } });
});
