import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { handleSitemapXmlRequest, listNativeCmsSitemap } from "./sitemap.ts";

test("native CMS sitemap filters unpublished records by tenant, preserves source kind, and bounds the query", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { assert.match(text, /LIMIT 5000/); assert.deepEqual(values, ["org_1"]); return { rows: [{ slug: "about", locale: "en", updated_at: "", kind: "page", status: "published", published_at: null, scheduled_publish_at: null }, { slug: "draft", locale: "en", updated_at: "", kind: "post", status: "draft", published_at: null, scheduled_publish_at: null }] as unknown as T[], rowCount: 2 }; }, async end() {} };
  assert.deepEqual((await listNativeCmsSitemap(database, "org_1")).map((row) => row.slug), ["about"]);
  assert.equal((await listNativeCmsSitemap(database, "org_1"))[0]?.kind, "page");
});

test("XML sitemap exposes canonical public URLs and published CMS entries", async () => {
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, values: readonly unknown[] = []) {
      assert.deepEqual(values, ["org_1"]);
      return {
        rows: [
          { slug: "about-us", locale: "en", updated_at: "2026-09-23T00:00:00Z", kind: "page", status: "published", published_at: null, scheduled_publish_at: null },
          { slug: "future", locale: "en", updated_at: "2026-09-23T00:00:00Z", kind: "post", status: "scheduled", published_at: null, scheduled_publish_at: "2999-01-01T00:00:00Z" },
        ] as unknown as T[],
        rowCount: 2,
      };
    },
    async end() {},
  };
  const response = await handleSitemapXmlRequest(
    new Request("https://worker.example/sitemap.xml"),
    database,
    "org_1",
    "https://universalmusic.vercel.app",
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /application\/xml/);
  const xml = await response.text();
  assert.match(xml, /https:\/\/universalmusic\.vercel\.app\/shop/);
  assert.match(xml, /https:\/\/universalmusic\.vercel\.app\/p\/about-us/);
  assert.doesNotMatch(xml, /future/);
});
