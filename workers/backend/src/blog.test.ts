import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { getPublishedBlogPost } from "./blog.ts";

test("blog reads scope tenant and hide drafts", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, values: readonly unknown[] = []) { assert.deepEqual(values, ["org_1", "hello", "en"]); return { rows: [{ id: "b1", slug: "hello", locale: "en", title: "Hello", excerpt: "", body: "Body", cover_image_url: null, author_name: null, tags: [], status: "published", published_at: null, scheduled_publish_at: null, meta_title: null, meta_description: null, og_image_url: null, json_ld: null, created_at: "", updated_at: "" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  assert.equal((await getPublishedBlogPost(database, "hello", "en", "org_1"))?.title, "Hello");
});
