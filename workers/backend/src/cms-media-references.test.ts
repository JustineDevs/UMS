import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { lockCmsMediaReferences } from "./cms-media-references.ts";

test("CMS media reference locks are tenant-scoped and deterministic", async () => {
  let statement = "";
  let values: readonly unknown[] = [];
  const transaction: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) {
      statement = text;
      values = params;
      return { rows: [{ deleted_at: null }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  const payload = { body: "<img src=\"https://cdn.example/a.png\">" };
  assert.equal(await lockCmsMediaReferences(transaction, "org_1", payload), true);
  assert.deepEqual(values, ["org_1", JSON.stringify(payload)]);
  assert.match(statement, /organization_id = \$1/);
  assert.match(statement, /strpos\(\$2, public_url\) > 0/);
  assert.match(statement, /ORDER BY id\s+FOR SHARE/);
});

test("CMS media writes reject tombstoned assets", async () => {
  const transaction: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>() {
      return { rows: [{ deleted_at: "2026-09-21T00:00:00Z" }] as T[], rowCount: 1 };
    },
    async end() {},
  };
  assert.equal(await lockCmsMediaReferences(transaction, "org_1", "https://cdn.example/deleted.png"), false);
});
