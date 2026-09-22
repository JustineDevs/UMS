import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { listNativeCmsSitemap } from "./sitemap.ts";

test("native CMS sitemap filters unpublished records by tenant, preserves source kind, and bounds the query", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: readonly unknown[] = []) { assert.match(text, /LIMIT 5000/); assert.deepEqual(values, ["org_1"]); return { rows: [{ slug: "about", locale: "en", updated_at: "", kind: "page", status: "published", published_at: null, scheduled_publish_at: null }, { slug: "draft", locale: "en", updated_at: "", kind: "post", status: "draft", published_at: null, scheduled_publish_at: null }] as unknown as T[], rowCount: 2 }; }, async end() {} };
  assert.deepEqual((await listNativeCmsSitemap(database, "org_1")).map((row) => row.slug), ["about"]);
  assert.equal((await listNativeCmsSitemap(database, "org_1"))[0]?.kind, "page");
});
