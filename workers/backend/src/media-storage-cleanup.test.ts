import assert from "node:assert/strict";
import test from "node:test";
import type { WorkerDatabaseClient } from "./database.ts";
import { runMediaStorageCleanupSweep } from "./media-storage-cleanup.ts";

type CleanupRow = { id: string; storage_path: string; tags: string[]; attempts: number };

function cleanupDatabase(options: { failClaim?: boolean; row?: CleanupRow } = {}): WorkerDatabaseClient {
  let claimed = false;
  return {
    async query<T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) {
      if (sql.includes("SELECT id::text, storage_path, tags, storage_cleanup_attempts")) {
        return { rows: [options.row ?? { id: "media-1", storage_path: "public/folder/file name.png", tags: ["catalog-product"], attempts: 0 }] as T[], rowCount: 1 };
      }
      if (sql.trimStart().startsWith("UPDATE public.cms_media")) {
        if (options.failClaim || claimed) return { rows: [] as T[], rowCount: 0 };
        claimed = true;
        return { rows: [{ ...(options.row ?? { id: "media-1", storage_path: "public/folder/file name.png", tags: ["catalog-product"], attempts: 0 }), id: String(values[0]), attempts: 1 }] as T[], rowCount: 1 };
      }
      return { rows: [] as T[], rowCount: 1 };
    },
    async end() {},
  };
}

const env = { SUPABASE_STORAGE_URL: "https://supabase.example", SUPABASE_SERVICE_ROLE_KEY: "service-key" };

test("media cleanup deletes a claimed tombstone and marks storage complete", async () => {
  const queries: string[] = [];
  const database = cleanupDatabase();
  const query = database.query.bind(database);
  database.query = async <T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) => {
    queries.push(sql);
    return query<T>(sql, values);
  };
  const requests: Request[] = [];
  const result = await runMediaStorageCleanupSweep(database, env, async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(result, { scanned: 1, deleted: 1, retried: 0 });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, "DELETE");
  assert.equal(requests[0].url, "https://supabase.example/storage/v1/object/catalog/public/folder/file%20name.png");
  assert.equal(requests[0].headers.get("apikey"), "service-key");
  assert.ok(queries.some((sql) => sql.trimStart().startsWith("UPDATE public.cms_media") && sql.includes("SET storage_cleanup_status = 'complete'")));
});

test("media cleanup treats an already-missing storage object as completed", async () => {
  const result = await runMediaStorageCleanupSweep(cleanupDatabase(), env, async () => new Response(null, { status: 404 }));
  assert.deepEqual(result, { scanned: 1, deleted: 1, retried: 0 });
});

test("media cleanup records retry state after storage failure", async () => {
  const statements: string[] = [];
  const database = cleanupDatabase();
  const query = database.query.bind(database);
  database.query = async <T extends Record<string, unknown>>(sql: string, values: readonly unknown[] = []) => {
    statements.push(sql);
    return query<T>(sql, values);
  };
  const result = await runMediaStorageCleanupSweep(database, env, async () => new Response(null, { status: 503 }));
  assert.deepEqual(result, { scanned: 1, deleted: 0, retried: 1 });
  assert.ok(statements.some((sql) => sql.trimStart().startsWith("UPDATE public.cms_media") && sql.includes("SET storage_cleanup_status = 'retry'")));
});

test("overlapping media cleanup sweeps claim each tombstone at most once", async () => {
  let claimed = false;
  let fetches = 0;
  const database: WorkerDatabaseClient = {
    async query<T extends Record<string, unknown>>(sql: string) {
      if (sql.includes("SELECT id::text, storage_path, tags, storage_cleanup_attempts")) return { rows: [{ id: "media-1", storage_path: "public/file.png", tags: [], attempts: 0 }] as T[], rowCount: 1 };
      if (sql.trimStart().startsWith("UPDATE public.cms_media")) {
        if (claimed) return { rows: [] as T[], rowCount: 0 };
        claimed = true;
        return { rows: [{ id: "media-1", storage_path: "public/file.png", tags: [], attempts: 1 }] as T[], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    },
    async end() {},
  };
  const fetcher: typeof fetch = async () => { fetches += 1; await Promise.resolve(); return new Response(null, { status: 204 }); };
  const results = await Promise.all([
    runMediaStorageCleanupSweep(database, env, fetcher),
    runMediaStorageCleanupSweep(database, env, fetcher),
  ]);
  assert.equal(fetches, 1);
  assert.equal(results.reduce((sum, item) => sum + item.deleted, 0), 1);
});

test("media cleanup skips external assets and rejects missing storage credentials before querying", async () => {
  const database = cleanupDatabase({ row: { id: "media-external", storage_path: "external/provider.png", tags: [], attempts: 0 } });
  let fetches = 0;
  const result = await runMediaStorageCleanupSweep(database, env, async () => { fetches += 1; return new Response(null, { status: 204 }); });
  assert.deepEqual(result, { scanned: 1, deleted: 1, retried: 0 });
  assert.equal(fetches, 0);

  let queries = 0;
  await assert.rejects(runMediaStorageCleanupSweep({ ...database, query: async () => { queries += 1; return { rows: [], rowCount: 0 }; } }, {}, async () => new Response(null, { status: 204 })), /media_storage_not_configured/);
  assert.equal(queries, 0);
});
