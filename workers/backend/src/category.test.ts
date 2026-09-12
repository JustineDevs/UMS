import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { getCategoryContent, listCategoryContent } from "./category.ts";

test("category content is tenant and locale scoped", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, values: readonly unknown[] = []) { assert.deepEqual(values, ["org_1", "guitars", "en"]); return { rows: [{ id: "c1", collection_id: null, collection_handle: "guitars", locale: "en", intro_html: "<p>Guitars</p>", banner_url: null, banner_alt: null, blocks: [], updated_at: "" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  assert.equal((await getCategoryContent(database, "guitars", "en", "org_1"))?.collection_handle, "guitars");
});

test("category content list is tenant and locale scoped", async () => {
  const database: WorkerDatabaseClient = { async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, values: readonly unknown[] = []) { assert.deepEqual(values, ["org_1", "en"]); return { rows: [{ collection_handle: "guitars", locale: "en" }] as unknown as T[], rowCount: 1 }; }, async end() {} };
  assert.equal((await listCategoryContent(database, "en", "org_1"))[0]?.collection_handle, "guitars");
});
