import { Client } from "pg";

export interface HyperdriveBinding {
  connectionString: string;
}

export type WorkerDatabaseRole = "app" | "medusa";

export interface WorkerDatabaseEnv {
  APP_HYPERDRIVE?: HyperdriveBinding;
  MEDUSA_HYPERDRIVE?: HyperdriveBinding;
  HYPERDRIVE?: HyperdriveBinding;
  APP_DB_URL?: string;
  MEDUSA_DB_URL?: string;
}

export interface WorkerDatabaseClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  end(): Promise<void>;
}

interface PgClient {
  connect(): Promise<unknown>;
  query<T>(
    text: string,
    values: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
  end(): Promise<void>;
}

type PgClientFactory = (options: { connectionString: string }) => PgClient;

function connectionString(
  env: WorkerDatabaseEnv,
  role: WorkerDatabaseRole,
): string {
  const value =
    role === "app"
      ? env.APP_HYPERDRIVE?.connectionString ??
        env.APP_DB_URL
      : env.MEDUSA_HYPERDRIVE?.connectionString ??
        env.MEDUSA_DB_URL ??
        // HYPERDRIVE is retained only as a local/test compatibility alias.
        env.HYPERDRIVE?.connectionString;
  if (!value) {
    throw new Error(`${role}_database_not_configured`);
  }
  return value;
}

/** Creates one request-scoped client; Hyperdrive owns pooling at the edge. */
export function createWorkerDatabaseClient(
  env: WorkerDatabaseEnv,
  roleOrFactory: WorkerDatabaseRole | PgClientFactory = "medusa",
  maybeFactory: PgClientFactory = (options) => new Client(options),
): WorkerDatabaseClient {
  const role: WorkerDatabaseRole =
    typeof roleOrFactory === "function" ? "medusa" : roleOrFactory;
  const legacyFactoryCall = typeof roleOrFactory === "function";
  const createClient =
    typeof roleOrFactory === "function" ? roleOrFactory : maybeFactory;
  const client = createClient({
    connectionString: legacyFactoryCall
      ? env.HYPERDRIVE?.connectionString ?? connectionString(env, role)
      : connectionString(env, role),
  });
  let connected = false;

  return {
    async query<T extends Record<string, unknown> = Record<string, unknown>>(
      text: string,
      values: readonly unknown[] = [],
    ): Promise<{ rows: T[]; rowCount: number | null }> {
      if (!connected) {
        await client.connect();
        connected = true;
      }
      const result = await client.query<T>(text, [...values]);
      return { rows: result.rows, rowCount: result.rowCount ?? null };
    },
    async end(): Promise<void> {
      if (connected) await client.end();
    },
  };
}

export async function withWorkerTransaction<T>(
  client: WorkerDatabaseClient,
  operation: (client: WorkerDatabaseClient) => Promise<T>,
): Promise<T> {
  await client.query("BEGIN");
  try {
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original operation error; the connection is closed by the owner.
    }
    throw error;
  }
}

export async function withWorkerDatabase<T>(
  env: WorkerDatabaseEnv,
  operation: (client: WorkerDatabaseClient) => Promise<T>,
  role: WorkerDatabaseRole = "medusa",
): Promise<T> {
  const client = createWorkerDatabaseClient(env, role);
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}
