import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { getPublishedAnnouncements } from "./announcement.ts";

test("announcements use tenant and locale filters and choose highest priority stack item", async () => {
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(_text: string, values: readonly unknown[] = []) {
      assert.deepEqual(values, ["org_1", "en"]);
      const rows = [{ id: "a", body: "old", body_format: "plain", link_url: null, link_label: null, dismissible: true, starts_at: null, ends_at: null, locale: "en", priority: "1", stack_group: "global", region_code: null }, { id: "b", body: "new", body_format: "plain", link_url: null, link_label: null, dismissible: true, starts_at: null, ends_at: null, locale: "en", priority: "2", stack_group: "global", region_code: null }];
      return { rows: rows as unknown as T[], rowCount: rows.length };
    },
    async end() {},
  };
  const rows = await getPublishedAnnouncements(database, "org_1", "en", null);
  assert.deepEqual(rows.map((row) => row.id), ["b"]);
});
