import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { getPublishedCmsPage, handleCmsPageRequest } from "./cms.ts";

function database(rows: Record<string, unknown>[]): WorkerDatabaseClient {
  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
      assert.match(text, /organization_id = \$1/);
      assert.deepEqual(values, ["org_1", "about", "en"]);
      return { rows: rows as T[], rowCount: rows.length };
    },
    async end() {},
  };
}

const row = {
  id: "page_1", organization_id: "org_1", slug: "about", locale: "en", page_type: "static",
  title: "About", body: "", blocks: [],
  tree: [{ id: "root", componentId: "hero", parentId: null, slot: null, props: {}, styles: {}, children: [] }],
  status: "published", published_at: null, scheduled_publish_at: null, meta_title: null,
  meta_description: null, canonical_url: null, og_image_url: null, json_ld: null,
  version: "3", updated_at: "2026-01-01T00:00:00.000Z",
};

test("CMS page reads are tenant scoped and preserve the canonical tree", async () => {
  const page = await getPublishedCmsPage(database([row]), "about", "en", "org_1");
  assert.equal(page?.organization_id, "org_1");
  assert.equal(page?.version, 3);
  assert.deepEqual(page?.tree, row.tree);
});

test("CMS page handler returns cacheable published content", async () => {
  const response = await handleCmsPageRequest(
    new Request("https://api.example/store/pages/about"), database([row]), "about", "org_1",
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Cache-Control") ?? "", /stale-while-revalidate/);
  const payload = (await response.json()) as { page: { tree: unknown } };
  assert.deepEqual(payload.page.tree, row.tree);
});

test("CMS page handler rejects an unconfigured tenant", async () => {
  const response = await handleCmsPageRequest(
    new Request("https://api.example/store/pages/about"), database([]), "about", undefined,
  );
  assert.equal(response.status, 503);
});
