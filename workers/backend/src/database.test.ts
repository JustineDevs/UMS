import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorkerDatabaseClient,
  withWorkerTransaction,
} from "./database.ts";

test("uses the Hyperdrive connection string when configured", async () => {
  const calls: string[] = [];
  class FakeClient {
    async connect(): Promise<void> {
      calls.push("connect");
    }
    async query<T>(): Promise<{ rows: T[]; rowCount: number }> {
      calls.push("query");
      return { rows: [], rowCount: 0 };
    }
    async end(): Promise<void> {
      calls.push("end");
    }
  }
  const client = createWorkerDatabaseClient(
    {
      HYPERDRIVE: { connectionString: "postgres://hyperdrive" },
      MEDUSA_DB_URL: "postgres://fallback",
    },
    (options) => {
      calls.push(`construct:${options.connectionString}`);
      return new FakeClient();
    },
  );
  await client.query("select 1");
  await client.end();
  assert.deepEqual(calls, [
    "construct:postgres://hyperdrive",
    "connect",
    "query",
    "end",
  ]);
});

test("keeps APP and Medusa database roles on their own bindings", async () => {
  const connections: string[] = [];
  class FakeClient {
    async connect(): Promise<void> {}
    async query<T>(): Promise<{ rows: T[]; rowCount: number }> {
      return { rows: [], rowCount: 0 };
    }
    async end(): Promise<void> {}
  }
  const env = {
    APP_HYPERDRIVE: { connectionString: "postgres://app" },
    MEDUSA_HYPERDRIVE: { connectionString: "postgres://medusa" },
  };
  const factory = (options: { connectionString: string }) => {
    connections.push(options.connectionString);
    return new FakeClient();
  };
  await createWorkerDatabaseClient(env, "app", factory).query("select 1");
  await createWorkerDatabaseClient(env, "medusa", factory).query("select 1");
  assert.deepEqual(connections, ["postgres://app", "postgres://medusa"]);
});

test("does not let the APP role fall back to the generic Medusa binding", () => {
  assert.throws(
    () =>
      createWorkerDatabaseClient({
        HYPERDRIVE: { connectionString: "postgres://medusa" },
        MEDUSA_DB_URL: "postgres://medusa-fallback",
      }, "app"),
    /app_database_not_configured/,
  );
});

test("fails explicitly when no database binding exists", () => {
  assert.throws(
    () => createWorkerDatabaseClient({}),
    /database_not_configured/,
  );
});

test("commits successful transactions and rolls back failed transactions", async () => {
  const statements: string[] = [];
  const client = {
    async query<T>(text: string): Promise<{ rows: T[]; rowCount: number }> {
      statements.push(text);
      return { rows: [], rowCount: 0 };
    },
    async end(): Promise<void> {},
  };
  await withWorkerTransaction(client, async (transaction) => {
    await transaction.query("SELECT 1");
    return "ok";
  });
  await assert.rejects(
    () =>
      withWorkerTransaction(client, async () => {
        throw new Error("write_failed");
      }),
    /write_failed/,
  );
  assert.deepEqual(statements, [
    "BEGIN",
    "SELECT 1",
    "COMMIT",
    "BEGIN",
    "ROLLBACK",
  ]);
});
