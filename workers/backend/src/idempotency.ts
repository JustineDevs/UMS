export type IdempotencyRecord = {
  key: string;
  requestHash: string;
  status: number;
  headers: Array<[string, string]>;
  body: string;
  createdAt: number;
};

export type IdempotencyStore = {
  get(key: string): Promise<IdempotencyRecord | null>;
  put(record: IdempotencyRecord): Promise<void>;
  claim?(
    key: string,
    requestHash: string,
    createdAt: number,
  ): Promise<"claimed" | "pending" | IdempotencyRecord | "conflict">;
  release?(key: string, requestHash: string): Promise<void>;
};

export type WorkerQueryResult<Row extends Record<string, unknown>> = {
  rows: Row[];
  rowCount: number | null;
};
export type WorkerQueryClient = {
  query<Row extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<WorkerQueryResult<Row>>;
};

export type WorkerKvNamespace = {
  get<T = unknown>(key: string, type: "json"): Promise<T | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
};

export class KvIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly namespace: WorkerKvNamespace,
    private readonly ttlSeconds = 86_400,
  ) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60)
      throw new Error("invalid_idempotency_ttl");
  }

  get(key: string): Promise<IdempotencyRecord | null> {
    return this.namespace.get<IdempotencyRecord>(key, "json");
  }

  put(record: IdempotencyRecord): Promise<void> {
    return this.namespace.put(record.key, JSON.stringify(record), {
      expirationTtl: this.ttlSeconds,
    });
  }
}

type IdempotencyRow = {
  idempotency_key: string;
  request_hash: string;
  response_status: number;
  response_headers: Array<[string, string]>;
  response_body: string;
  created_at: string;
};

export class HyperdriveIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly database: WorkerQueryClient,
    private readonly ttlSeconds = 86_400,
  ) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60)
      throw new Error("invalid_idempotency_ttl");
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    const result = await this.database.query<IdempotencyRow>(
      `SELECT idempotency_key, request_hash, response_status, response_headers, response_body, created_at
       FROM public.worker_idempotency_records
       WHERE idempotency_key = $1 AND expires_at > now()`,
      [key],
    );
    const row = result.rows[0];
    if (!row || !Array.isArray(row.response_headers)) return null;
    return {
      key: row.idempotency_key,
      requestHash: row.request_hash,
      status: row.response_status,
      headers: row.response_headers,
      body: row.response_body,
      createdAt: Date.parse(row.created_at),
    };
  }

  async put(record: IdempotencyRecord): Promise<void> {
    const result = await this.database.query(
      `UPDATE public.worker_idempotency_records
       SET state = 'completed', response_status = $3, response_headers = $4::jsonb, response_body = $5,
           created_at = to_timestamp($6 / 1000.0), expires_at = to_timestamp(($6 + $7 * 1000) / 1000.0)
       WHERE idempotency_key = $1 AND request_hash = $2 AND state = 'pending'`,
      [
        record.key,
        record.requestHash,
        record.status,
        JSON.stringify(record.headers),
        record.body,
        record.createdAt,
        this.ttlSeconds,
      ],
    );
    if (result.rowCount !== 1) throw new Error("atomic_claim_lost");
  }

  async claim(
    key: string,
    requestHash: string,
    createdAt: number,
  ): Promise<"claimed" | "pending" | IdempotencyRecord | "conflict"> {
    const result = await this.database.query<{
      state: string;
      request_hash: string;
    }>(
      `INSERT INTO public.worker_idempotency_records
         (idempotency_key, request_hash, state, response_status, response_headers, response_body, created_at, expires_at)
       VALUES ($1, $2, 'pending', 102, '[]'::jsonb, '', to_timestamp($3 / 1000.0), to_timestamp(($3 + $4 * 1000) / 1000.0))
       ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       WHERE public.worker_idempotency_records.expires_at <= now()
       RETURNING state, request_hash`,
      [key, requestHash, createdAt, this.ttlSeconds],
    );
    if (result.rowCount === 1) return "claimed";
    const existing = await this.database.query<
      IdempotencyRow & { state: string }
    >(
      `SELECT idempotency_key, request_hash, state, response_status, response_headers, response_body, created_at
       FROM public.worker_idempotency_records WHERE idempotency_key = $1`,
      [key],
    );
    const row = existing.rows[0];
    if (!row || row.request_hash !== requestHash) return "conflict";
    if (row.state === "pending") return "pending";
    if (!Array.isArray(row.response_headers)) return "conflict";
    return {
      key: row.idempotency_key,
      requestHash: row.request_hash,
      status: row.response_status,
      headers: row.response_headers,
      body: row.response_body,
      createdAt: Date.parse(row.created_at),
    };
  }

  async release(key: string, requestHash: string): Promise<void> {
    await this.database.query(
      `DELETE FROM public.worker_idempotency_records WHERE idempotency_key = $1 AND request_hash = $2 AND state = 'pending'`,
      [key, requestHash],
    );
  }
}

export type IdempotencyResult =
  | { kind: "executed"; response: Response }
  | { kind: "replayed"; response: Response }
  | { kind: "conflict"; response: Response };

const MAX_KEY_LENGTH = 255;

function validateKey(key: string): string {
  const normalized = key.trim();
  if (!normalized || normalized.length > MAX_KEY_LENGTH)
    throw new Error("invalid_idempotency_key");
  return normalized;
}

function responseFromRecord(record: IdempotencyRecord): Response {
  const headers = new Headers(record.headers);
  headers.set("Idempotency-Replayed", "true");
  return new Response(record.body, { status: record.status, headers });
}

async function snapshotResponse(
  response: Response,
): Promise<{ body: string; headers: Array<[string, string]> }> {
  const body = await response.clone().text();
  const headers: Array<[string, string]> = [];
  response.headers.forEach((value, key) => headers.push([key, value]));
  return { body, headers };
}

/**
 * Execute a mutation once and replay the exact response for a matching key.
 * Production stores must make the initial put atomic for a key.
 */
export async function executeIdempotently(
  store: IdempotencyStore,
  key: string,
  requestHash: string,
  operation: () => Promise<Response>,
): Promise<IdempotencyResult> {
  const normalizedKey = validateKey(key);
  if (store.claim) {
    const claim = await store.claim(normalizedKey, requestHash, Date.now());
    if (claim === "conflict")
      return { kind: "conflict", response: conflictResponse() };
    if (claim === "pending")
      return { kind: "conflict", response: inProgressResponse() };
    if (claim !== "claimed")
      return { kind: "replayed", response: responseFromRecord(claim) };
    try {
      const response = await operation();
      const snapshot = await snapshotResponse(response);
      // Transient upstream failures must remain retryable. Validation and
      // business failures are replay-safe, but caching a 5xx would turn an
      // outage into a permanent idempotency replay until the record expires.
      if (response.status >= 500) {
        await store.release?.(normalizedKey, requestHash);
        return { kind: "executed", response };
      }
      await store.put({
        key: normalizedKey,
        requestHash,
        status: response.status,
        headers: snapshot.headers,
        body: snapshot.body,
        createdAt: Date.now(),
      });
      return { kind: "executed", response };
    } catch (error) {
      await store.release?.(normalizedKey, requestHash);
      throw error;
    }
  }
  const existing = await store.get(normalizedKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return {
        kind: "conflict",
        response: new Response(
          JSON.stringify({ error: "idempotency_key_reused" }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            },
          },
        ),
      };
    }
    return { kind: "replayed", response: responseFromRecord(existing) };
  }

  const response = await operation();
  const snapshot = await snapshotResponse(response);
  if (response.status >= 500) {
    return { kind: "executed", response };
  }
  await store.put({
    key: normalizedKey,
    requestHash,
    status: response.status,
    headers: snapshot.headers,
    body: snapshot.body,
    createdAt: Date.now(),
  });
  return { kind: "executed", response };
}

function conflictResponse(): Response {
  return new Response(JSON.stringify({ error: "idempotency_key_reused" }), {
    status: 409,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function inProgressResponse(): Response {
  return new Response(
    JSON.stringify({ error: "idempotency_request_in_progress" }),
    {
      status: 409,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Retry-After": "2",
      },
    },
  );
}
